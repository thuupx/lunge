# MCP Tool Surface

This is the proposed tool API the agent sees. Design principles:

- **Few, powerful tools** rather than many narrow ones — keeps the agent's tool list small
  and the schema token cost low.
- **Summary-first output** — every tool defaults to `verbosity: "summary"`; the agent
  escalates with `inspect_response` when it needs more.
- **Handles over payloads** — large results are referenced by id, not inlined.

Tools are grouped below. Each shows key inputs and the shape of the output.

## Request tools

### `http_request`  `P1`
Execute a single REST/HTTP request.

```jsonc
// input
{
  "method": "POST",
  "url": "https://api.example.com/login",
  "headers": { "Content-Type": "application/json" },
  "body": { "user": "a", "pass": "{{secret_pass}}" },   // json | form | multipart | raw
  "query": { "verbose": "1" },
  "auth": { "type": "bearer", "token": "{{token}}" },
  "assert": [                                            // optional inline assertions
    { "status": 200 },
    { "jsonpath": "$.token", "exists": true }
  ],
  "extract": { "token": "$.token" },                    // capture into a variable
  "env": "dev",
  "verbosity": "summary",                               // summary | headers | full
  "timeoutMs": 10000
}
```

```jsonc
// output
{
  "status": 200,
  "timeMs": 142,
  "assertions": { "passed": 2, "failed": 0, "results": [ /* per-assertion */ ] },
  "extracted": { "token": "***redacted***" },
  "bodySummary": { "type": "object", "keys": ["token","expiresIn"], "sample": { /*…*/ } },
  "responseHandle": "resp_a1b2",                         // for inspect_response
  "truncated": true
}
```

### `graphql_request`  `P1`
```jsonc
{ "url": "…/graphql", "query": "query($id:ID!){ user(id:$id){ name } }",
  "variables": { "id": "42" }, "auth": {…}, "assert": [...], "extract": {...} }
```

### `graphql_introspect`  `P1`
Fetch and return a **summarized** schema (types, queries, mutations, subscriptions) so the
agent can discover operations. Full SDL spilled to a handle.

### `ws_session`  `P1` (bounded)
Connect, optionally send, collect frames until a stop condition, return summarized batch.
```jsonc
{ "url": "wss://…", "headers": {…}, "subprotocols": ["json"],
  "send": [ { "json": { "type": "subscribe", "topic": "prices" } } ],
  "collect": { "maxMessages": 20, "maxDurationMs": 5000, "until": "$.type == 'done'" },
  "assert": [ { "anyFrame": { "jsonpath": "$.type", "equals": "ack" } } ] }
```
Output: frame count, summarized frames, assertion results, `responseHandle` for all frames.

### `sse_session`  `P1`
Same bounded-collection model as `ws_session` but for SSE. Inputs mirror an HTTP GET plus a
`collect` stop condition; output summarizes the collected events.

### `grpc_call`  `P3`
Unary + streaming (bounded) with reflection or `.proto`/descriptor input.

## Persistent connection tools (`P2`)

For long-lived interactive sessions where bounded collection isn't enough:

- `ws_open` → `{ handle }`
- `ws_send` `{ handle, json | text | binary }`
- `ws_recv` `{ handle, maxMessages?, maxDurationMs? }` → buffered frames since last recv
- `ws_close` `{ handle }`

## Inspection tools

### `inspect_response`  `P1`
Drill into a stored response without re-running it — the primary token-saving escape hatch.
```jsonc
{ "handle": "resp_a1b2", "jsonpath": "$.items[0:5]", "verbosity": "full" }
```

## State / environment tools

### `set_env`  `P1`
Create/update a named environment's variables (supports `secret: true`).

### `get_env` / `list_envs`  `P1`
Inspect current variables (secrets shown masked).

## Collection tools (`P2`)

### `list_collections`
Discover collection files under the configured directory.

### `run_collection`
```jsonc
{ "path": "examples/auth-flow.yaml", "env": "dev",
  "only": ["login","get-profile"], "verbosity": "summary" }
```
Runs steps in order, threads extracted variables between them, returns a per-step
pass/fail summary + a run `reportHandle`.

### `save_request`
Persist the last (or a specified) ad-hoc request into a collection file, so exploratory
agent testing can be promoted into a reusable suite.

## Utility tools (`P2`)

- `import_curl` `{ curl: "curl -X POST …" }` → structured request (optionally saved).
- `import_openapi` `{ path | url }` → generate a collection skeleton. `P4`

## Output/token conventions (apply to all tools)

| `verbosity` | What the agent gets |
| --- | --- |
| `summary` (default) | status, timing, assertion results, body *shape* + small sample, handle |
| `headers` | the above + response headers (pruned) |
| `full` | full body inline (still truncated to the size budget; use `inspect_response` for slices) |

- Secrets are always masked in output.
- Any body exceeding the size budget is spilled to disk and represented by a `responseHandle`.
