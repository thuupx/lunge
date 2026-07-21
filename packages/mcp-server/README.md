# lunge

An [MCP server](https://modelcontextprotocol.io) that gives AI agents a full API
testing toolkit — REST, GraphQL, WebSocket, and SSE — without bloating the
context window.

Lunge is **agent-native**: every tool returns a small, structured summary the
LLM can act on immediately. Large payloads are spilled to a Rust-side store and
referenced by handle. Tests are declarative JSON (`assert` + `extract`), not
imperative JavaScript.

**See more:** <https://lunge.thupham.io.vn/>

## Install

```bash
npm install -g lunge
# or use via npx (no global install needed):
npx -y lunge
```

## Register with an MCP client

Add Lunge to any MCP-capable client's config:

```json
{
  "mcpServers": {
    "lunge": {
      "command": "npx",
      "args": ["-y", "lunge"]
    }
  }
}
```

Config file locations for common clients:

| Client | Path |
| --- | --- |
| Cursor | `~/.cursor/mcp.json` or `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Devin CLI | `~/.config/devin/config.json` |
| VS Code | `~/.vscode/mcp.json` or `.vscode/mcp.json` |

Restart the client and ask the agent to list tools — you should see
`http_request`, `graphql_request`, `ws_session`, `sse_session`,
`inspect_response`, and the rest of the surface below.

## Tools

### Request

| Tool | Signature | Notes |
| --- | --- | --- |
| `http_request` | `http_request(url, method?, body?, auth?, assert?, extract?)` | REST/HTTP with inline assertions and `{{var}}` extraction. |
| `graphql_request` | `graphql_request(url, query, variables?, auth?, extract?)` | Queries + mutations. Separates GraphQL errors from HTTP status. |
| `graphql_introspect` | `graphql_introspect(url)` | Returns an enriched, token-efficient schema (field signatures, nested fields, input types, enums). |
| `ws_session` | `ws_session(url, send?, collect?, assert?)` | Bounded WebSocket session: connect → send → collect until stop condition. |
| `ws_open` / `ws_send` / `ws_recv` / `ws_close` | `ws_open(url) → handle; ws_send(handle, msg); ws_recv(handle); ws_close(handle)` | Persistent WebSocket handles for interactive flows. |
| `sse_session` | `sse_session(url, headers?, collect?, assert?)` | Bounded SSE collector with event assertions. |

### Inspect

| Tool | Signature | Notes |
| --- | --- | --- |
| `inspect_response` | `inspect_response(handle, jsonpath?, maxItems?)` | RFC 9535 JSONPath with filters (`$.items[?@.id==1]`), `maxItems` truncation, parse-error surfacing. |

### Env

| Tool | Signature | Notes |
| --- | --- | --- |
| `set_env` / `list_envs` | `set_env(name, vars); list_envs()` | Manage environments and variables. Secret values are masked in summaries. |

### Collection

| Tool | Signature | Notes |
| --- | --- | --- |
| `run_collection` / `list_collections` | `run_collection(path, only?, tags?); list_collections()` | Run declarative YAML/JSON collections: ordered steps, variable threading, `only`/`tags` filters. |

### Import

| Tool | Signature | Notes |
| --- | --- | --- |
| `import_curl` | `import_curl(cmd)` | Parse a cURL command into a request definition. |
| `import_openapi` | `import_openapi(spec)` | Import operations from an OpenAPI spec. |
| `import_har` | `import_har(file)` | Import entries from a HAR archive. |

### Policy

| Tool | Signature | Notes |
| --- | --- | --- |
| `save_request` | `save_request(name, def)` | Persist an ad-hoc request for reuse. |
| `set_policy` | `set_policy(rules)` | Configure safety policies (allowed hosts, timeouts, redaction). |

## Example: declarative test

```jsonc
// http_request with inline assertions + extraction
{
  "method": "POST",
  "url": "https://api.example.com/login",
  "body": { "user": "a", "pass": "{{secret_pass}}" },
  "assert": [
    { "status": 200 },
    { "jsonpath": "$.token", "exists": true },
    { "timeMs": { "lt": 500 } }
  ],
  "extract": { "token": "$.token" }
}
```

```jsonc
// response
{
  "status": 200,
  "timeMs": 142,
  "assertions": { "passed": 3, "failed": 0 },
  "extracted": { "token": "***redacted***" },
  "bodySummary": { "type": "object", "keys": ["token", "expiresIn"] },
  "responseHandle": "resp_a1b2"
}
```

Assertion matchers: `equals`, `notEquals`, `in`, `contains`, `matches`,
`exists`, `gt`, `gte`, `lt`, `lte`, `length`, plus `not:` negation and
`schema:` for JSON Schema validation.

## Architecture

This package is the thin TypeScript MCP layer. The execution engine
(HTTP/GraphQL/WS/SSE clients, assertions, JSONPath, summarization) lives in a
Rust core compiled to a native addon via [napi-rs](https://napi.rs), published
as [`lunge-core`](https://www.npmjs.com/package/lunge-core)
with platform-specific binary packages (`lunge-core-darwin-arm64`,
`lunge-core-linux-x64-gnu`, etc.).

The FFI contract is JSON string in / JSON string out; results are parsed in
`src/native.ts` so the rest of the server works with plain objects.

## Run from source

```bash
git clone <repo>
cd lunge
pnpm install
pnpm build          # builds the Rust core, then this server

# run the server over stdio
node packages/mcp-server/dist/index.js

# end-to-end verification (spins up a local test server, drives every tool)
pnpm e2e
```

## License

MIT
