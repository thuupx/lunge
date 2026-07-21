/**
 * Importers that convert OpenAPI/Swagger and HAR documents into Lunge collection files.
 * The output is a Collection object (see collections.ts) that can be serialized to YAML/JSON
 * and run with `run_collection`.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Collection, Step } from "./collections.js";

interface OpenApiPathItem {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: { name: string; in: string; required?: boolean; schema?: Record<string, unknown> }[];
  requestBody?: {
    content?: Record<string, { schema?: Record<string, unknown>; example?: unknown }>;
  };
  responses?: Record<string, unknown>;
}
type OpenApiPaths = Record<string, Record<string, OpenApiPathItem>>;

interface OpenApiDoc {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string }[];
  host?: string;
  basePath?: string;
  paths?: OpenApiPaths;
  components?: { securitySchemes?: Record<string, unknown> };
}

/** Param names that look like API keys / tokens / secrets. */
const API_KEY_PATTERNS = /^(api[-_]?key|apikey|token|secret|access[-_]?token|auth)$/i;

function isApiKeyParam(name: string): boolean {
  return API_KEY_PATTERNS.test(name);
}

function exampleForSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  const type = schema.type as string | undefined;
  if (type === "object" && schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      const ex = exampleForSchema(v);
      if (ex !== undefined) obj[k] = ex;
    }
    return obj;
  }
  if (type === "array" && schema.items) {
    const ex = exampleForSchema(schema.items as Record<string, unknown>);
    return ex !== undefined ? [ex] : [];
  }
  if (type === "string") return "";
  if (type === "integer" || type === "number") return 0;
  if (type === "boolean") return false;
  return undefined;
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return base + path.slice(1);
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return base + path;
}

function buildBase(doc: OpenApiDoc): string {
  if (doc.servers && doc.servers.length) return doc.servers[0].url;
  if (doc.host) return `https://${doc.host}${doc.basePath ?? ""}`;
  return "";
}

/** Convert an OpenAPI/Swagger document (parsed) into a Lunge Collection. */
export function openApiToCollection(doc: OpenApiDoc, opts: { includeTags?: string[]; maxSteps?: number } = {}): Collection {
  const base = buildBase(doc);
  const steps: Step[] = [];
  const paths = doc.paths ?? {};
  const max = opts.maxSteps ?? 200;
  // Track required var placeholders so we can declare them at the collection level.
  const requiredVars = new Set<string>();
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) continue;
      if (opts.includeTags && opts.includeTags.length && !(op.tags ?? []).some((t) => opts.includeTags!.includes(t))) continue;
      if (steps.length >= max) break;
      const url = joinUrl(base, path);
      const request: Record<string, unknown> = { method: method.toUpperCase(), url };
      const query: Record<string, unknown> = {};
      let apiKeyAuth: { type: "apikey"; in: "query" | "header"; key: string; value: string } | undefined;
      for (const p of op.parameters ?? []) {
        const example = exampleForSchema(p.schema);
        if (p.in === "path") {
          // Path params are always required. Substitute {name} → {{name}} in the URL
          // and declare the var so the user knows to fill it in.
          request.url = (request.url as string).replace(`{${p.name}}`, `{{${p.name}}}`);
          requiredVars.add(p.name);
        } else if (p.in === "query") {
          if (isApiKeyParam(p.name)) {
            // API key-style param: model as auth block with a {{var}} placeholder.
            const varName = p.name;
            apiKeyAuth = { type: "apikey", in: "query", key: p.name, value: `{{${varName}}}` };
            if (p.required) requiredVars.add(varName);
            // Do NOT also add it to `query` — the auth block handles it.
          } else if (p.required) {
            // Required param without a concrete example: use a {{var}} placeholder
            // so the user knows to fill it in (via env or collection vars).
            if (example === undefined || example === "" || example === 0 || example === false) {
              query[p.name] = `{{${p.name}}}`;
              requiredVars.add(p.name);
            } else {
              query[p.name] = example;
            }
          } else {
            // Optional param: only include if there's a meaningful example/default.
            if (example !== undefined && example !== "" && example !== 0 && example !== false) {
              query[p.name] = example;
            }
          }
        } else if (p.in === "header") {
          if (isApiKeyParam(p.name) && !apiKeyAuth) {
            apiKeyAuth = { type: "apikey", in: "header", key: p.name, value: `{{${p.name}}}` };
            if (p.required) requiredVars.add(p.name);
          } else if (p.required) {
            request.headers = { ...(request.headers as object | undefined), [p.name]: `{{${p.name}}}` };
            requiredVars.add(p.name);
          }
        }
      }
      if (Object.keys(query).length) request.query = query;
      if (apiKeyAuth) request.auth = apiKeyAuth;
      // Request body.
      const jsonBody = op.requestBody?.content?.["application/json"];
      if (jsonBody) {
        const body = jsonBody.example ?? exampleForSchema(jsonBody.schema);
        if (body !== undefined) request.body = body;
      }
      const id = op.operationId ?? `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
      steps.push({
        id,
        type: "http",
        request,
        tags: op.tags,
        // Light default assertion: expect a 2xx.
        assert: [{ status: { gte: 200, lt: 300 } }],
      });
    }
  }
  // Declare required var placeholders at the collection level so the user
  // knows what to fill in. Secrets reference {{env.NAME}} per the format docs.
  const vars: Record<string, unknown> = {};
  for (const v of requiredVars) {
    if (isApiKeyParam(v)) {
      vars[v] = `{{env.${v.toUpperCase()}}}`;
    } else {
      vars[v] = "";
    }
  }
  const col: Collection = { name: doc.info?.title ?? "imported-openapi", steps };
  if (doc.info?.description) col.description = doc.info.description;
  if (Object.keys(vars).length) col.vars = vars;
  return col;
}

export function loadOpenApi(path: string): OpenApiDoc {
  const text = readFileSync(path, "utf8");
  if (extname(path) === ".json") return JSON.parse(text) as OpenApiDoc;
  return parseYaml(text) as OpenApiDoc;
}

// ---------------------------------------------------------------------------
// HAR -> Collection
// ---------------------------------------------------------------------------

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers?: { name: string; value: string }[];
    queryString?: { name: string; value: string }[];
    postData?: { mimeType: string; text?: string };
  };
  response?: { status: number };
}
interface HarDoc {
  log?: { entries?: HarEntry[] };
}

export function harToCollection(har: HarDoc, opts: { maxSteps?: number; filter?: (e: HarEntry) => boolean } = {}): Collection {
  const entries = har.log?.entries ?? [];
  const max = opts.maxSteps ?? 200;
  const steps: Step[] = [];
  for (let i = 0; i < entries.length && steps.length < max; i++) {
    const e = entries[i];
    if (opts.filter && !opts.filter(e)) continue;
    const req = e.request;
    let parsedUrl = req.url;
    try {
      const u = new URL(req.url);
      // Reconstruct without query string; we'll move it to `query`.
      parsedUrl = `${u.origin}${u.pathname}`;
    } catch {
      /* keep raw */
    }
    const request: Record<string, unknown> = { method: (req.method || "GET").toUpperCase(), url: parsedUrl };
    if (req.queryString && req.queryString.length) {
      const q: Record<string, unknown> = {};
      for (const item of req.queryString) q[item.name] = item.value;
      request.query = q;
    }
    if (req.headers && req.headers.length) {
      const h: Record<string, unknown> = {};
      for (const item of req.headers) {
        const lower = item.name.toLowerCase();
        if (lower === "content-type" || lower === "content-length") continue;
        h[item.name] = item.value;
      }
      if (Object.keys(h).length) request.headers = h;
    }
    if (req.postData?.text) {
      try {
        request.body = JSON.parse(req.postData.text);
      } catch {
        request.body = req.postData.text;
        request.bodyType = "text";
      }
    }
    steps.push({
      id: `har-${i + 1}`,
      type: "http",
      request,
      assert: [{ status: { gte: 200, lt: 300 } }],
    });
  }
  return { name: "imported-har", steps };
}

export function loadHar(path: string): HarDoc {
  return JSON.parse(readFileSync(path, "utf8")) as HarDoc;
}
