# Roadmap

Phased plan from empty repo to a gRPC-capable, CI-friendly tool. Each phase ends with a
usable, demoable state. Effort markers are relative (S/M/L), not calendar estimates.

## Phase 0 - Scaffolding & the FFI spine  `S`

Goal: prove the Rust↔TS↔MCP pipeline end-to-end with one trivial tool.

- [x] Monorepo setup (pnpm workspaces): `crates/core` + `packages/mcp-server`.
- [x] napi-rs crate that compiles to a `.node` addon; expose one async fn (`ping`).
- [x] TS `native.ts` wrapper + typed binding; local build script.
- [x] Minimal MCP stdio server registering a single `ping` tool that calls into Rust.
- [x] Round-trip verified over stdio (`pnpm smoke`: initialize → tools/list → tools/call).
- [ ] Wire into a real MCP client (Windsurf/Claude Desktop) and confirm a round trip.
- [ ] CI skeleton: build the addon on macOS/Linux/Windows, run lint + unit tests.

**Exit criteria**: an agent can call `ping` and get a Rust-produced response over stdio. ✅ (met locally)

## Phase 1 - MVP: REST + GraphQL + assertions + token optimizer  `L`

Goal: the tool is genuinely useful for day-to-day API testing of request/response APIs.

- [x] Rust `http` module (reqwest, rustls): methods, headers, query, bodies (json/form/text),
      timeouts, redirects, decoding. (multipart deferred)
- [x] `graphql` module (query/mutation + `errors` parsing). (`graphql_introspect` deferred)
- [x] Assertion engine (`assert`): status, headers, JSONPath, latency, regex, negation,
      matchers (equals/in/contains/gt.../length). (JSON-Schema deferred)
- [x] Templating/vars (`template`): `{{var}}`, dynamic funcs (uuid/now/randomInt),
      response extraction/chaining.
- [x] Environments: `set_env`/`list_envs`, secret masking.
- [x] **Token optimizer** (`optimizer`) + response store: structural summarization,
      truncation, spill-to-store, `inspect_response`, `verbosity` levels.
- [x] MCP tools: `http_request`, `graphql_request`, `inspect_response`, env tools.
- [x] Examples + e2e verification against a local mock server (`pnpm e2e`).

**Exit criteria**: agent can log in, chain a token, call a protected endpoint, assert the
result, and drill into a large response - all within a small token budget. ✅ (verified by `pnpm e2e`)

## Phase 2 - Streaming + reusable collections  `L`

Goal: cover WebSocket/SSE and make tests reusable & shareable.

- [x] Rust `ws` module: bounded sessions (connect/send/collect/until). (persistent handles deferred)
- [x] Rust `sse` module: bounded event collection + assertions.
- [ ] GraphQL-over-WS subscriptions.
- [x] Frame/event assertions (`anyFrame`/`anyEvent`, counts).
- [x] Declarative collection loader (YAML/JSON). (published JSON Schema deferred)
- [x] Collection runner: ordered steps, variable threading, `only`/`tags`.
- [x] Tools: `ws_session`, `sse_session`, `run_collection`, `list_collections`.
      (persistent WS tools, `save_request` deferred)
- [x] Ergonomics: `import_curl`. (host allow/deny list, `dry-run` deferred)
- [x] Auth helpers: bearer/api-key/basic first-class. (OAuth2 deferred)

**Exit criteria**: agent can run a saved multi-step YAML suite that mixes HTTP + WS/SSE,
and can subscribe to a stream and assert on collected frames. ✅ (verified by `pnpm e2e`)

## Phase 3 - gRPC + reporting  `M`

- [ ] Rust `grpc` module (tonic): unary + streaming (bounded), server reflection,
      `.proto`/descriptor loading, metadata, deadlines, TLS.
- [ ] `grpc_call` tool.
- [ ] Reporting: JSON run report, compact human summary, JUnit XML export for CI.
- [ ] Timing breakdown (DNS/connect/TLS/TTFB/total).
- [ ] OAuth2 authorization-code + refresh; HMAC signing hooks.

**Exit criteria**: gRPC services can be tested without a `.proto` (via reflection), and a
collection run emits a CI-consumable report.

## Phase 4 - Advanced & imports  `M`

- [ ] Data-driven runs (CSV/JSON datasets, `repeat`).
- [ ] OpenAPI/Swagger import → collection skeleton.
- [ ] HAR import.
- [ ] AWS SigV4 auth.
- [ ] Snapshot testing of responses (record/compare) with review-friendly diffs.
- [ ] Optional: remote/HTTP-SSE MCP transport for shared/CI usage (revisit distribution).

## Cross-phase engineering practices

- **Testing**: Rust unit tests per module + integration tests against a local mock server;
  TS tests for the MCP layer and collection runner. A shared example suite doubles as a
  smoke test.
- **Prebuilt binaries**: napi-rs CI matrix publishes per-platform `.node` artifacts so
  consumers never need a Rust toolchain.
- **Versioning**: the FFI contract is JSON-based and versioned; breaking changes bump a
  contract version checked at startup.
- **Security**: secret redaction everywhere output is produced; host allow/deny + dry-run
  to prevent the agent from hitting unintended targets; stdout reserved strictly for MCP.

## Suggested first task

Start with **Phase 0**. It is small but de-risks the single biggest unknown in this design -
the Rust → napi-rs → TypeScript → MCP round trip - before any protocol work begins.
