/**
 * Declarative collection loading and execution. Collections are YAML/JSON files describing
 * ordered steps with per-step assertions and variable extraction (see docs/collection-format.md).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { httpRequest, graphqlRequest, wsSession, sseSession } from "./native.js";
import type { ExecResult } from "./native.js";
import type { Session } from "./session.js";

export interface Step {
  id?: string;
  type?: "http" | "graphql" | "ws" | "sse";
  request?: Record<string, unknown>;
  assert?: unknown[];
  extract?: Record<string, string>;
  tags?: string[];
  skip?: boolean;
  continueOnError?: boolean;
}
export interface Collection {
  name?: string;
  description?: string;
  vars?: Record<string, unknown>;
  defaults?: { headers?: Record<string, unknown>; timeoutMs?: number };
  steps?: Step[];
}

const PLACEHOLDER = /\{\{\s*([^}]+?)\s*\}\}/g;

function lookup(base: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[seg];
    return undefined;
  }, base);
}

/** Resolve {{...}} inside collection var values against the current variable base. */
function resolveColVars(vars: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (typeof v === "string") {
      out[k] = v.replace(PLACEHOLDER, (_m, expr) => {
        const val = lookup(base, String(expr).trim());
        return val === undefined ? "" : typeof val === "string" ? val : JSON.stringify(val);
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function loadCollection(path: string): Collection {
  const text = readFileSync(path, "utf8");
  if (extname(path) === ".json") return JSON.parse(text) as Collection;
  return parseYaml(text) as Collection;
}

export function listCollectionFiles(dir: string): string[] {
  const root = resolve(dir);
  const out: string[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 3) return;
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const p = join(d, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p, depth + 1);
      else if ([".yaml", ".yml", ".json"].includes(extname(p))) out.push(p);
    }
  };
  try {
    walk(root, 0);
  } catch {
    /* ignore */
  }
  return out;
}

async function execStep(step: Step, vars: Record<string, unknown>, defaults: Collection["defaults"]): Promise<ExecResult> {
  const req = { ...(step.request ?? {}) } as Record<string, unknown>;
  req.headers = { ...(defaults?.headers ?? {}), ...((req.headers as object) ?? {}) };
  if (defaults?.timeoutMs && req.timeoutMs === undefined) req.timeoutMs = defaults.timeoutMs;
  const spec = { ...req, assert: step.assert, extract: step.extract, vars };
  switch (step.type ?? "http") {
    case "graphql":
      return graphqlRequest(spec);
    case "ws":
      return wsSession(spec);
    case "sse":
      return sseSession(spec);
    default:
      return httpRequest(spec);
  }
}

export interface StepReport {
  id: string;
  type: string;
  ok: boolean;
  status?: number | null;
  assertions?: { passed: number; failed: number; skipped: number };
  failures?: string[];
  note?: string | null;
  error?: string | null;
  skipped?: boolean;
}

export interface RunReport {
  name: string;
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  steps: StepReport[];
}

export async function runCollection(
  session: Session,
  path: string,
  opts: { env?: string; only?: string[]; tags?: string[] } = {},
): Promise<RunReport> {
  const col = loadCollection(path);
  const steps = col.steps ?? [];
  const report: RunReport = { name: col.name ?? path, ok: true, passed: 0, failed: 0, skipped: 0, steps: [] };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const id = step.id ?? `step-${i + 1}`;
    const selected =
      (!opts.only || opts.only.includes(id)) &&
      (!opts.tags || (step.tags ?? []).some((t) => opts.tags!.includes(t)));
    if (step.skip || !selected) {
      report.skipped++;
      report.steps.push({ id, type: step.type ?? "http", ok: true, skipped: true });
      continue;
    }

    const base = session.mergedVars(opts.env);
    const colVars = resolveColVars(col.vars ?? {}, base);
    const vars = { ...colVars, ...base };

    const result = await execStep(step, vars, col.defaults);
    session.applyExtracted(result.extracted);

    const failures = (result.assertions?.results ?? []).filter((r) => !r.ok && !r.skipped).map((r) => `${r.desc}: ${r.detail ?? ""}`);
    const ok = !result.error && (result.ok ?? false);
    report.steps.push({
      id,
      type: step.type ?? "http",
      ok,
      status: result.status,
      assertions: result.assertions
        ? { passed: result.assertions.passed, failed: result.assertions.failed, skipped: result.assertions.skipped }
        : undefined,
      failures: failures.length ? failures : undefined,
      note: result.note,
      error: result.error,
    });
    if (ok) report.passed++;
    else {
      report.failed++;
      report.ok = false;
      if (!step.continueOnError) break;
    }
  }
  return report;
}
