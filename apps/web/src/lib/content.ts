export type Protocol = {
  name: string;
  tagline: string;
  description: string;
  status: "shipped" | "planned";
};

export const protocols: Protocol[] = [
  {
    name: "REST / HTTP",
    tagline: "Every method, every body type",
    description:
      "GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS + custom verbs. JSON, form, multipart, raw, binary bodies. Query params, headers, cookies, redirects, timeouts, retries.",
    status: "shipped",
  },
  {
    name: "GraphQL",
    tagline: "Queries, mutations, introspection",
    description:
      "Queries, mutations, and variables over HTTP. Schema introspection returns an enriched, token-efficient summary so the agent can discover operations without pasting docs.",
    status: "shipped",
  },
  {
    name: "WebSocket",
    tagline: "Bounded + persistent sessions",
    description:
      "Bounded ws_session: connect → send → collect until stop condition. Persistent handles (ws_open / ws_send / ws_recv / ws_close) for interactive flows. Subprotocols, auth headers, per-frame assertions.",
    status: "shipped",
  },
  {
    name: "SSE",
    tagline: "Server-Sent Events collector",
    description:
      "Subscribe to an SSE endpoint and collect events until a stop condition. Parses event, id, data, retry; auto-parses JSON data. Last-Event-ID resume support planned.",
    status: "shipped",
  },
  {
    name: "gRPC",
    tagline: "Unary + streaming",
    description:
      "Unary and streaming calls with reflection or .proto / descriptor input. Deferred to a later phase.",
    status: "planned",
  },
];

export type Tool = {
  name: string;
  category: "Request" | "Inspect" | "Env" | "Collection" | "Import" | "Policy";
  signature: string;
  description: string;
};

export const tools: Tool[] = [
  {
    name: "http_request",
    category: "Request",
    signature: "http_request(url, method?, body?, auth?, assert?, extract?)",
    description:
      "REST/HTTP request with auth, inline assertions, and {{var}} extraction. Returns a token-efficient summary.",
  },
  {
    name: "graphql_request",
    category: "Request",
    signature: "graphql_request(url, query, variables?, auth?, extract?)",
    description:
      "GraphQL query/mutation over HTTP. Separates GraphQL errors from HTTP status. Supports {{var}} extraction.",
  },
  {
    name: "graphql_introspect",
    category: "Request",
    signature: "graphql_introspect(url)",
    description:
      "Returns an enriched schema: field signatures, 1-level nested fields, inline input types, and enum values.",
  },
  {
    name: "ws_session",
    category: "Request",
    signature: "ws_session(url, send?, collect?, assert?)",
    description:
      "Bounded WebSocket session: connect, send messages, collect frames until a stop condition, return summarized batch.",
  },
  {
    name: "ws_open / ws_send / ws_recv / ws_close",
    category: "Request",
    signature: "ws_open(url) → handle; ws_send(handle, msg); ws_recv(handle); ws_close(handle)",
    description:
      "Persistent WebSocket handles for long-lived interactive sessions buffered on the Rust side.",
  },
  {
    name: "sse_session",
    category: "Request",
    signature: "sse_session(url, headers?, collect?, assert?)",
    description:
      "Bounded SSE collector with event assertions and summarized batch output.",
  },
  {
    name: "inspect_response",
    category: "Inspect",
    signature: "inspect_response(handle, jsonpath?, maxItems?)",
    description:
      "RFC 9535 JSONPath with filters, maxItems truncation, and parse-error surfacing. Reads the enriched schema field for introspection results.",
  },
  {
    name: "set_env / list_envs",
    category: "Env",
    signature: "set_env(name, vars); list_envs()",
    description:
      "Manage environments and variables. Secret values are masked in summaries.",
  },
  {
    name: "run_collection / list_collections",
    category: "Collection",
    signature: "run_collection(path, only?, tags?); list_collections()",
    description:
      "Run declarative YAML/JSON collections: ordered steps, variable threading, only/tags filters.",
  },
  {
    name: "import_curl / import_openapi / import_har",
    category: "Import",
    signature: "import_curl(cmd); import_openapi(spec); import_har(file)",
    description:
      "Import existing request definitions from cURL commands, OpenAPI specs, and HAR archives.",
  },
  {
    name: "save_request / set_policy",
    category: "Policy",
    signature: "save_request(name, def); set_policy(rules)",
    description:
      "Persist ad-hoc requests and configure safety policies (allowed hosts, timeouts, redaction).",
  },
];

export type Pillar = {
  title: string;
  description: string;
};

export const pillars: Pillar[] = [
  {
    title: "Agent-native",
    description:
      "Designed for LLM tool calls, not human UIs. Every tool returns a small, structured summary the agent can act on immediately.",
  },
  {
    title: "Token-efficient",
    description:
      "Every response is filtered, truncated, and summarized. Full payloads are spilled to a store and referenced by handle so the context window stays small.",
  },
  {
    title: "Fast & portable",
    description:
      "A Rust core (execution + protocols + summarization) exposed to a thin TypeScript MCP layer via napi-rs. One local binary, every platform.",
  },
  {
    title: "Ad-hoc + reusable",
    description:
      "Agents can fire one-off requests or create, save, and re-run declarative collections stored as plain, git-friendly YAML/JSON files.",
  },
];

export const comparison: { pain: string; approach: string }[] = [
  { pain: "Require human clicking in a GUI", approach: "Agent-native: everything is an MCP tool call" },
  { pain: "Postman is heavy, enterprise features are paywalled", approach: "Small, open, single local binary + thin MCP layer" },
  { pain: "Verbose responses blow up the LLM context window", approach: "Rust core summarizes/compresses output before it reaches the agent" },
  { pain: "Collections are locked into proprietary formats", approach: "Plain YAML/JSON files, git-friendly" },
  { pain: "Separate tools per protocol", approach: "One server for REST/GraphQL/WS/SSE/gRPC" },
];
