# Features

Features are grouped into **per-protocol** capabilities and **cross-cutting** capabilities
that apply to all protocols. Each item is tagged with its target phase (see
[roadmap.md](./roadmap.md)): `P1` (MVP), `P2`, `P3`, `P4`.

## 1. REST / HTTP  `P1`

- All methods: GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS + custom verbs.
- Request body: JSON, form-urlencoded, multipart/form-data (file uploads), raw, binary.
- Query params, path params, headers, cookies.
- Automatic content-type handling and response decoding (JSON/text/binary detection).
- Redirect control, timeouts, retries with backoff, connection reuse.
- Compression (gzip/br/deflate) handled transparently.
- TLS options: custom CA, client certs, `insecure` opt-in for self-signed. `P2`

## 2. GraphQL  `P1`

- Queries, mutations, and variables over HTTP.
- **Schema introspection** — fetch and summarize the schema so the agent can discover
  operations without a human pasting docs.
- Named operations and multi-operation documents.
- GraphQL error surface (the `errors` array) parsed and asserted separately from HTTP status.
- GraphQL-over-WS subscriptions (`graphql-ws` protocol). `P2`

## 3. WebSocket  `P1` (bounded) / `P2` (persistent handles)

- **Bounded session** (`P1`): connect → send messages → collect frames until
  stop condition (max messages / max duration / matcher) → return summarized batch.
- **Persistent handle** (`P2`): `ws_open` returns a handle; `ws_send` / `ws_recv` / `ws_close`
  operate on the live connection buffered on the Rust side.
- Subprotocols, custom headers (auth), ping/pong keepalive.
- Text and binary frames; JSON auto-parse of text frames.
- Per-frame assertions (e.g. "a frame matching `$.type == 'ack'` arrives within 2s").

## 4. Server-Sent Events (SSE)  `P1`

- Subscribe to an SSE endpoint and collect events until a stop condition.
- Parse `event`, `id`, `data`, `retry` fields; auto-parse JSON `data`.
- Last-Event-ID resume support. `P2`
- Assertions over the collected event stream (count, ordering, field matchers).

## 5. gRPC  `P3` (optional early)

- Unary, server-streaming, client-streaming, and bidi calls (streaming via bounded session).
- **Server reflection** to discover services/methods without a local `.proto`.
- Load from `.proto` files or a compiled descriptor set as an alternative.
- Metadata (headers), deadlines, TLS.

## Cross-cutting features (all protocols)

### 6. Assertions engine  `P1`

- Status code / range.
- Headers (exact, contains, regex, present/absent).
- Body via **JSONPath** and **JMESPath** selectors.
- **JSON Schema** validation of the body.
- Latency/response-time thresholds.
- Text/regex body matching.
- Negative assertions and soft assertions (collect all failures vs fail-fast).
- Structured pass/fail result with minimal diffs (token-efficient).

### 7. Variables, environments & chaining  `P1`

- Named environments (`dev`/`staging`/`prod`) each holding key/value vars.
- `{{variable}}` templating in URLs, headers, bodies, and assertions.
- Built-in dynamic functions: `{{uuid}}`, `{{now}}`, `{{randomInt}}`, `{{base64(...)}}`, etc.
- **Response extraction & chaining**: capture a value from response A (via JSONPath) into a
  variable and reuse it in request B — enables login → use-token → call-protected-endpoint flows.
- Secret masking: mark vars as secret so they are redacted in all output/logs.
- `.env` file import. `P2`

### 8. Authentication helpers  `P2`

- Bearer / API-key / Basic auth as first-class options.
- OAuth2 client-credentials and authorization-code (token fetch + auto-attach + refresh).
- HMAC/request-signing hooks.
- AWS SigV4. `P4`

### 9. Collections & reusable suites  `P2`

- Declarative YAML/JSON collections (see [collection-format.md](./collection-format.md)).
- Ordered steps with per-step assertions and variable extraction.
- Setup/teardown steps, and step-level `skip`/`continueOnError`.
- Run a whole collection, a single step, or a tagged subset.
- Data-driven runs: iterate a step over a dataset (CSV/JSON rows). `P4`

### 10. Token optimizer / output control  `P1`

- `verbosity` levels: `summary` (default) / `headers` / `full`.
- Automatic structural summarization + truncation of large bodies.
- Response spill-to-disk with handles + `inspect_response` for on-demand drill-down.
- Configurable size budgets (per response and per session).

### 11. Reporting & observability  `P3`

- Machine-readable run report (JSON) and a compact human summary.
- JUnit XML export for CI. `P3`
- Timing breakdown (DNS/connect/TLS/TTFB/total) per request.

### 12. Ergonomics & safety

- **cURL import**: paste a curl command → structured request. `P2`
- **OpenAPI import**: generate a collection skeleton from an OpenAPI/Swagger spec. `P4`
- **HAR import**. `P4`
- Host allowlist / denylist and a `dry-run` mode so the agent can't hit unintended targets. `P2`
- Redaction of secrets in every code path that produces output.

## Explicit non-goals

- No GUI (that's the whole point — Postman/Bruno already do that).
- Not a load/performance testing tool (k6/Gatling own that space).
- Not a mock-server/contract-broker (may integrate later, out of scope for core).
