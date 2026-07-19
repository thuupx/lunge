# AGENTS.md

Project info for AI agents / contributors working on **volley**.

## What this is

An MCP server that lets AI agents perform API testing (REST/GraphQL/WS/SSE/gRPC).
Architecture: Rust core (`crates/core`, napi-rs **v3** native addon) + TypeScript MCP layer
(`packages/mcp-server`). See `docs/` for the full plan.

Implemented tools: `http_request`, `graphql_request`, `graphql_introspect`, `ws_session`,
`ws_open`/`ws_send`/`ws_recv`/`ws_close`, `sse_session`, `inspect_response`, `set_env`,
`list_envs`, `run_collection`, `list_collections`, `import_curl`, `import_openapi`,
`import_har`, `save_request`, `set_policy`. Deferred: gRPC, data-driven runs, OAuth2.

## Token optimization features

- `graphql_introspect` returns enriched schema: field signatures (`name(args): Type`), 1-level
  nested fields for object return types (including list-wrapped like `[SalesOutput!]!`), inline
  input type definitions, and enum values.
- `inspect_response` supports RFC 9535 JSONPath with filters (`$.items[?@.id==1]`,
  `$.queries[?search(@.sig,"getSales")]`), `maxItems` truncation, and surfaces parse errors.
  String literals in filters need double quotes. The `search()` function does substring matching.
  For `graphql_introspect` results, `inspect_response` reads the enriched `schema` field
  (not the raw `bodyJson`), so `$.queries`, `$.mutations`, `$.inputTypes` work directly.
- `verbosity: full` is auto-downgraded to `summary` when `extract` is set (extracted values
  already contain the needed data, so the full body is redundant).
- WS/SSE frame/event arrays are capped at 10 items in `full` verbosity with truncation markers.
- Tool descriptions are kept short to minimize `tools/list` token weight.

## Layout

- `crates/core` — Rust engine compiled to a `.node` addon via napi-rs. FFI contract is
  JSON-string in / JSON-string out. Generated `index.js` / `index.d.ts` / `*.node` are
  produced by `napi build` and are git-ignored.
- `packages/mcp-server` — TypeScript MCP server (stdio transport). Tools live in
  `src/tools/`; `src/native.ts` is the typed wrapper over the addon.
- `scripts/e2e.mjs` — end-to-end stdio verification (31 checks).

## Commands (run from repo root)

- Install: `pnpm install`
- Build everything: `pnpm build` (builds Rust core first, then the TS server)
- Build core only (debug): `pnpm build:core`
- Build server only: `pnpm build:server`
- Rust tests: `pnpm test:core`
- End-to-end verification: `pnpm e2e` (requires `pnpm build` first; spins up a local
  test server and drives every tool over stdio)
- Run the server (dev): `pnpm dev`

## napi-rs notes

- Uses napi-rs v3 (`napi`/`napi-derive` = "3", `napi-build` stays "2.3" — it is v3-compatible).
- `napi build --platform` targets `aarch64-apple-darwin` on this machine and writes the
  addon + generated `index.js`/`index.d.ts` into `crates/core/`.
- If generated `index.d.ts` looks stale, the crate's per-target incremental cache is the
  cause; a clean rebuild of the crate regenerates the type defs.

## Conventions

- The Rust core must NEVER write to stdout (stdout is the MCP JSON-RPC channel); use stderr.
- Cross the FFI boundary with JSON strings; keep camelCase on the wire (serde
  `rename_all = "camelCase"`) so it matches the TypeScript types.
- Surface every new core function in `packages/mcp-server/src/native.ts` with an explicit
  TypeScript signature.

## MCP client config (stdio)

```json
{
  "mcpServers": {
    "volley": {
      "command": "node",
      "args": ["<repo>/packages/mcp-server/dist/index.js"]
    }
  }
}
```
