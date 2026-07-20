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

- `crates/core` - Rust engine compiled to a `.node` addon via napi-rs. FFI contract is
  JSON-string in / JSON-string out. Generated `index.js` / `index.d.ts` / `*.node` are
  produced by `napi build` and are git-ignored.
- `packages/mcp-server` - TypeScript MCP server (stdio transport). Tools live in
  `src/tools/`; `src/native.ts` is the typed wrapper over the addon.
- `apps/web` - Next.js 16 + shadcn (base-nova preset, Tailwind v4) marketing site + docs.
  Custom dark theme (OLED + green accent) per `ui-ux-pro-max` design system. Pages: `/`
  (landing: Hero / Pillars / Protocols / Comparison / CTA) and `/docs/*` (overview,
  install, quickstart, tools, architecture, collections). Tools reference at
  `/docs/tools` is an interactive client component backed by `src/lib/content.ts`.
- `scripts/e2e.mjs` - end-to-end stdio verification (31 checks).

## Commands (run from repo root)

- Install: `pnpm install`
- Build everything: `pnpm build` (builds Rust core first, then the TS server)
- Build core only (debug): `pnpm build:core`
- Build server only: `pnpm build:server`
- Rust tests: `pnpm test:core`
- End-to-end verification: `pnpm e2e` (requires `pnpm build` first; spins up a local
  test server and drives every tool over stdio)
- Run the server (dev): `pnpm dev`
- Bump release version: `pnpm release <patch|minor|major> [--tag] [--dry-run]` or
  `pnpm release --version=X.Y.Z` (see `scripts/release.sh`)
- Run the web app (dev): `pnpm dev:web` (Next.js 16 on http://localhost:3000)
- Build the web app: `pnpm build:web`
- Lint the web app: `pnpm lint:web`

## napi-rs notes

- Uses napi-rs v3 (`napi`/`napi-derive` = "3", `napi-build` stays "2.3" - it is v3-compatible).
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
      "command": "npx",
      "args": ["-y", "@thupham/volley-mcp"]
    }
  }
}
```

## npm publishing

Volley is published to npm as two packages under the `@volley` org:

- **`@thupham/volley-core`** — the Rust native addon (napi-rs). Published as a main package
  plus platform-specific optional dependencies (`@thupham/volley-core-darwin-arm64`,
  `@thupham/volley-core-linux-x64-gnu`, etc.). The generated `index.js` requires the right
  platform package at runtime.
- **`@thupham/volley-mcp`** — the TypeScript MCP server. Depends on `@thupham/volley-core`. The
  `bin` name is `volley-mcp`, so `npx -y @thupham/volley-mcp` runs it directly.

Cross-platform releases run via GitHub Actions (`.github/workflows/release.yml`):
push a `v*` tag → matrix build for 8 targets → `napi prepublish` for `@thupham/volley-core`
→ `npm publish` for `@thupham/volley-mcp`.

For a local single-platform publish (testing): `pnpm publish` (runs
`scripts/publish.sh`, requires `npm login` + `@thupham` org membership).
Flags: `--core` / `--mcp` to publish one package, `--dry-run`, `--no-build`,
`--otp=123456` for 2FA.
