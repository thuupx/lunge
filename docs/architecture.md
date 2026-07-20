# Architecture

## 1. High-level overview

```
┌──────────────────────────────────────────────────────────────────┐
│  AI Agent (Cursor / Windsurf / Claude Desktop / any MCP client)    │
└───────────────────────────────┬──────────────────────────────────┘
                                 │  MCP protocol (JSON-RPC over stdio)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  MCP Layer  -  TypeScript (@modelcontextprotocol/sdk)              │
│                                                                    │
│  • Tool registration & JSON-schema validation (zod)               │
│  • Session/state manager (envs, saved responses, ws/sse handles)   │
│  • Response shaping for the model (final token budgeting)          │
│  • Loads collection files (YAML/JSON) & orchestrates runs          │
└───────────────────────────────┬──────────────────────────────────┘
                                 │  napi-rs FFI (sync + async fns,
                                 │  ThreadsafeFunction for progress)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Core Engine  -  Rust (compiled to a native .node addon)           │
│                                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ HTTP/REST  │ │  GraphQL   │ │ WebSocket  │ │ SSE            │  │
│  │ (reqwest)  │ │ (reqwest)  │ │(tungstenite)│ │(reqwest stream)│  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ gRPC(tonic)│ │ Assertion  │ │ Templating │ │ Token          │  │
│  │  (phase 3) │ │  engine    │ │ & vars     │ │ optimizer      │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Response store (spill large bodies to disk, return a handle)  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬──────────────────────────────────┘
                                 ▼
                         Target APIs under test
```

## 2. Why this split

- **TypeScript for MCP**: the official MCP SDK, tool schema tooling (`zod`), and the
  broadest client compatibility live in the TS/Node ecosystem. Writing the protocol layer
  here is low-friction.
- **Rust for the core**: request execution, protocol clients, assertions, templating and -
  most importantly - **output summarization/compression** are CPU/IO heavy and benefit from
  Rust's performance and strong async story (`tokio`). This is where the "token-killer"
  value is produced, consistent with the RTK philosophy already in this repo.
- **napi-rs** bridges them: the Rust crate compiles to a `.node` native addon that TS
  `require`s directly - no subprocess, no serialization overhead beyond the FFI marshaling.

## 3. Repository layout (monorepo)

```
volley/
├── crates/
│   └── core/                # Rust core engine (napi-rs crate)
│       ├── src/
│       │   ├── lib.rs        # napi exports (the FFI surface)
│       │   ├── http.rs       # REST client
│       │   ├── graphql.rs    # GraphQL + introspection
│       │   ├── ws.rs         # WebSocket bounded sessions
│       │   ├── sse.rs        # SSE bounded sessions
│       │   ├── grpc.rs       # gRPC (phase 3)
│       │   ├── assert.rs     # assertion engine (JSONPath, schema, etc.)
│       │   ├── template.rs   # {{var}} resolution + functions
│       │   ├── optimizer.rs  # token optimizer / summarizer
│       │   └── store.rs      # response spill-to-disk + handles
│       ├── Cargo.toml
│       └── build.rs
├── packages/
│   └── mcp-server/          # TypeScript MCP server
│       ├── src/
│       │   ├── index.ts      # stdio server bootstrap
│       │   ├── tools/        # one file per MCP tool
│       │   ├── session.ts    # env + response-handle + ws/sse state
│       │   ├── collections.ts# load/validate/run YAML/JSON collections
│       │   └── native.ts     # typed wrapper over the .node addon
│       ├── package.json
│       └── tsconfig.json
├── docs/                    # (this folder)
├── examples/                # sample collections & env files
└── package.json             # workspace root (pnpm/npm workspaces)
```

## 4. Streaming strategy (WebSocket & SSE) - the key design choice

Streaming protocols do **not** map naturally to a single request/response tool call, and
pushing every frame to the model is a token disaster. We solve both problems with the
**bounded session** model:

> A WS/SSE tool call opens the connection, optionally sends messages, then **collects frames
> until a stop condition** (max messages, max duration, or a matcher/pattern is seen), then
> returns a single **summarized batch**.

Benefits:
- Across the napi-rs boundary this is still one async call in → one result out. No need to
  stream individual frames over FFI (which would require `ThreadsafeFunction` per frame).
- The agent gets a compact, assertable summary instead of a firehose.
- Long-lived connections are still possible via **persistent session handles**: `ws_open`
  returns a handle, and follow-up `ws_send` / `ws_recv` calls operate on it. Here the Rust
  side keeps the socket alive on a `tokio` task and buffers frames; TS polls with `ws_recv`.

`ThreadsafeFunction` is reserved for *optional* progress callbacks (e.g. "collected 12/50
messages") during a long collection, not for delivering payloads to the model.

## 5. FFI boundary contract

To keep the boundary clean and versionable:

- All calls cross the boundary as **JSON strings** (request spec in, result out). This
  decouples the Rust struct layout from the TS types and makes the contract easy to evolve.
- Request/response types are defined once as JSON Schema (or a shared `.d.ts` + `serde`
  structs) and validated on the TS side with `zod` before the call.
- Async Rust functions are exposed as JS `Promise`s via napi-rs `#[napi]` async support.
- The Rust side never prints to stdout (stdout is reserved for the MCP JSON-RPC stream);
  all diagnostics go to stderr.

## 6. State & session management

State lives in the TS layer (single process, per MCP session):

- **Environments/variables**: named sets of key/values (e.g. `dev`, `staging`) with secret
  masking. Support chaining - extract a value from response A and feed it into request B.
- **Response handles**: every response over a size threshold is stored (by the Rust
  `store` module) and referenced by an id like `resp_a1b2`. The agent can later call
  `inspect_response` with a JSONPath to pull only the slice it needs.
- **Connection handles**: open WS/SSE/gRPC-stream sessions keyed by id.

## 7. Token optimizer (the core value)

Implemented in Rust (`optimizer.rs`), applied to every response before it returns:

1. **Structural summarization** - for large JSON, return a *shape/skeleton* (keys, types,
   array lengths, a few sample elements) instead of the full body.
2. **Truncation with markers** - cap strings/arrays at configurable limits with
   `…(+N more)` markers, preserving valid structure.
3. **Header/noise pruning** - drop chatty headers (e.g. tracing, CDN) by default; keep an
   allowlist (content-type, auth-relevant, rate-limit).
4. **Diff-only mode** - when an expected value is provided, return only the assertion
   result + a minimal diff, not the full body.
5. **Spill + handle** - full body written to disk; agent gets a handle and a summary, and
   opts in to more detail only when needed.

Every optimization is configurable per call (`verbosity: summary | headers | full`) so the
agent can escalate detail on demand.

## 8. Build & packaging

- `crates/core` builds per-platform prebuilt `.node` binaries (macOS arm64/x64, Linux
  gnu/musl, Windows) via napi-rs CLI in CI, published alongside the npm package.
- End users install one npm package; the right prebuilt binary is selected at install time
  (no Rust toolchain required for consumers).
- MCP client config example (stdio):

  ```json
  {
    "mcpServers": {
      "volley": { "command": "npx", "args": ["-y", "volley"] }
    }
  }
  ```
