/**
 * Per-process session state: environments, extracted (chained) variables, and the
 * response store used by `inspect_response`. Also owns secret redaction.
 */
import type { ExecResult } from "./native.js";

export type Verbosity = "summary" | "headers" | "full";

interface EnvVar {
  value: unknown;
  secret?: boolean;
}

export interface Policy {
  allow: string[];
  deny: string[];
  dryRun: boolean;
}

export class Session {
  private envs = new Map<string, Record<string, EnvVar>>();
  private activeEnv: string | undefined;
  private extracted: Record<string, unknown> = {};
  private store = new Map<string, ExecResult>();
  private secretValues = new Set<string>();
  private counter = 0;
  private lastRequest: { type: string; request: Record<string, unknown>; assert?: unknown[]; extract?: Record<string, string> } | undefined;
  policy: Policy = { allow: [], deny: [], dryRun: false };

  setEnv(name: string, vars: Record<string, unknown>): void {
    const normalized: Record<string, EnvVar> = {};
    for (const [k, v] of Object.entries(vars)) {
      if (v && typeof v === "object" && "value" in (v as object)) {
        const ev = v as EnvVar;
        normalized[k] = { value: ev.value, secret: ev.secret };
        if (ev.secret) this.trackSecret(ev.value);
      } else {
        normalized[k] = { value: v };
      }
    }
    this.envs.set(name, normalized);
    this.activeEnv = name;
  }

  listEnvs(): string[] {
    return [...this.envs.keys()];
  }

  /** Env variables (masked) for display. */
  describeEnv(name?: string): Record<string, unknown> {
    const env = this.envs.get(name ?? this.activeEnv ?? "");
    if (!env) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(env)) out[k] = v.secret ? "***" : v.value;
    return out;
  }

  /** Merge env values + extracted vars into the map the Rust templating consumes. */
  mergedVars(envName?: string): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    const env = this.envs.get(envName ?? this.activeEnv ?? "");
    if (env) for (const [k, v] of Object.entries(env)) merged[k] = v.value;
    Object.assign(merged, this.extracted);
    // Expose env under `env.NAME` too (collections reference {{env.X}}).
    merged.env = env
      ? Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v.value]))
      : {};
    return merged;
  }

  applyExtracted(map: Record<string, unknown> | undefined): void {
    if (map) Object.assign(this.extracted, map);
  }

  /**
   * Validate a URL against the active policy. Returns an error string if the URL is denied,
   * or a synthetic dry-run result object when dryRun is enabled. Returns null when the request
   * should proceed normally.
   */
  checkPolicy(url: string): { blocked: true; error: string } | { dryRun: true; result: import("./native.js").ExecResult } | null {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      host = url;
    }
    const denied = this.policy.deny.some((p) => matchHost(host, p));
    if (denied) return { blocked: true, error: `host '${host}' is denied by policy` };
    const allowed = this.policy.allow.length === 0 || this.policy.allow.some((p) => matchHost(host, p));
    if (!allowed) return { blocked: true, error: `host '${host}' is not in the allow-list` };
    if (this.policy.dryRun) {
      return {
        dryRun: true,
        result: {
          ok: true,
          error: null,
          status: null,
          statusText: "DRY RUN",
          note: "dry-run: request not sent",
        },
      };
    }
    return null;
  }

  private trackSecret(value: unknown): void {
    if (typeof value === "string" && value.length >= 3) this.secretValues.add(value);
  }

  /** Redact any known secret substrings from a payload. */
  redact<T>(payload: T): T {
    if (this.secretValues.size === 0) return payload;
    let text = JSON.stringify(payload);
    for (const s of this.secretValues) {
      text = text.split(s).join("***");
    }
    return JSON.parse(text) as T;
  }

  storeResponse(result: ExecResult): string {
    const handle = `resp_${(++this.counter).toString(36)}`;
    this.store.set(handle, result);
    // Bound the store so long sessions don't grow unbounded.
    if (this.store.size > 50) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    return handle;
  }

  getStored(handle: string): ExecResult | undefined {
    return this.store.get(handle);
  }

  recordRequest(type: string, request: Record<string, unknown>, assert?: unknown[], extract?: Record<string, string>): void {
    this.lastRequest = { type, request, assert, extract };
  }

  consumeLastRequest():
    | { type: string; request: Record<string, unknown>; assert?: unknown[]; extract?: Record<string, string> }
    | undefined {
    return this.lastRequest;
  }
}

/** Glob-style host match: `*` matches any, `*.example.com` matches subdomains. */
function matchHost(host: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".example.com"
    return host.endsWith(suffix) || host === suffix.slice(1);
  }
  return host === pattern;
}
