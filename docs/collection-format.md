# Declarative Collection Format

Collections let exploratory agent testing be promoted into **reusable, git-friendly test
suites**. They are plain YAML (JSON is also accepted - same schema). A JSON Schema will be
published so editors and the agent get validation/autocomplete.

## Goals

- Readable and diff-friendly (no proprietary binary format).
- One format across REST/GraphQL/WS/SSE/gRPC.
- Support variable extraction and chaining between steps.
- Keep secrets out of the file (reference env vars instead).

## Top-level structure

```yaml
version: 1
name: Auth and profile flow
description: Log in, then fetch the profile with the returned token.

# Variables usable via {{name}}. Values can be literals or reference the active env.
vars:
  baseUrl: https://api.example.com
  # secrets are NOT stored here - reference an environment variable instead
  password: "{{env.LOGIN_PASSWORD}}"

# Optional: default settings applied to every step
defaults:
  timeoutMs: 10000
  headers:
    Accept: application/json

steps:
  - id: login
    type: http                 # http | graphql | ws | sse | grpc
    request:
      method: POST
      url: "{{baseUrl}}/login"
      body:
        username: admin
        password: "{{password}}"
    assert:
      - status: 200
      - jsonpath: "$.token"
        exists: true
    extract:
      token: "$.token"          # captured into a run-scoped variable

  - id: get-profile
    type: http
    request:
      method: GET
      url: "{{baseUrl}}/me"
      auth:
        type: bearer
        token: "{{token}}"      # from the previous step
    assert:
      - status: 200
      - jsonpath: "$.username"
        equals: admin
```

## Step schema (common fields)

| Field | Meaning |
| --- | --- |
| `id` | Unique step id (used for `only`, reporting, and referencing extracts) |
| `type` | `http` \| `graphql` \| `ws` \| `sse` \| `grpc` |
| `request` | Protocol-specific request spec (mirrors the matching MCP tool input) |
| `assert` | List of assertions (see below) |
| `extract` | Map of `varName: <jsonpath>` to capture values into run scope |
| `tags` | Labels for selective runs |
| `skip` | `true` to skip |
| `continueOnError` | Keep running subsequent steps even if this one fails |
| `repeat` | `{ dataset: <path>, as: row }` for data-driven iteration (`P4`) |

## Protocol-specific `request` blocks

### GraphQL
```yaml
- id: get-user
  type: graphql
  request:
    url: "{{baseUrl}}/graphql"
    query: |
      query($id: ID!) { user(id: $id) { id name } }
    variables: { id: "42" }
```

### WebSocket (bounded)
```yaml
- id: price-stream
  type: ws
  request:
    url: "wss://{{host}}/ws"
    send:
      - json: { type: subscribe, topic: prices }
    collect:
      maxMessages: 10
      maxDurationMs: 5000
      until: "$.type == 'complete'"
  assert:
    - anyFrame: { jsonpath: "$.type", equals: "ack" }
```

### SSE
```yaml
- id: notifications
  type: sse
  request:
    url: "{{baseUrl}}/events"
    collect: { maxEvents: 5, maxDurationMs: 4000 }
  assert:
    - eventCount: { min: 1 }
```

## Assertion vocabulary

Each item in `assert` is one condition:

```yaml
- status: 200                         # exact
- status: { in: [200, 201] }          # membership
- header: { name: content-type, contains: json }
- jsonpath: "$.items.length"          # selector + matcher
  gte: 1
- jsonpath: "$.name"
  equals: "admin"
- jsonpath: "$.email"
  matches: ".+@.+"                    # regex
- schema: ./schemas/user.json         # JSON Schema validation
- timeMs: { lt: 500 }                 # latency budget
- not: { jsonpath: "$.error", exists: true }   # negation
```

Matchers: `equals`, `notEquals`, `in`, `contains`, `matches` (regex), `exists`,
`gt`/`gte`/`lt`/`lte`, `min`/`max`, `length`.

## Environments

Environments are stored separately from collections so secrets and per-stage config stay
out of the suite file:

```yaml
# examples/env.dev.yaml
name: dev
vars:
  host: api.dev.example.com
  LOGIN_PASSWORD:
    value: "s3cr3t"
    secret: true          # masked in all output/logs
```

Env vars are referenced from collections via `{{env.NAME}}` and selected at run time
(`run_collection { env: "dev" }`). Environment values override collection `vars` of the
same name. `.env` file import is planned for `P2`.

## Run semantics

- Steps run **in declared order**; extracted variables are visible to all later steps.
- A failed assertion fails the step (and the run) unless `continueOnError: true`.
- `run_collection` supports `only: [id...]` and `tags: [...]` to run a subset.
- Output is a per-step pass/fail summary plus a `reportHandle` for the full machine report.
