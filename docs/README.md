# volley

An **MCP (Model Context Protocol) server that lets AI agents perform API testing
autonomously** - REST, GraphQL, WebSocket, SSE, and (later) gRPC - without any GUI,
manual clicking, or heavyweight desktop app.

It is a lightweight, token-efficient alternative to Postman/Bruno for the era of
AI coding agents. The agent calls tools directly; there are no humans in the loop and
no bloated feature surface to pay for.

## Why this exists

| Pain with Postman/Bruno | volley approach |
| --- | --- |
| Require human clicking in a GUI | Agent-native: everything is an MCP tool call |
| Postman is heavy, enterprise features are paywalled | Small, open, single local binary + thin MCP layer |
| Verbose responses blow up the LLM context window | Rust core summarizes/compresses output before it reaches the agent |
| Collections are locked into proprietary formats | Plain YAML/JSON files, git-friendly |
| Separate tools per protocol | One server for REST/GraphQL/WS/SSE/gRPC |

## Design pillars

1. **Agent-native** - designed for LLM tool calls, not human UIs.
2. **Token-efficient** - every response is filtered, truncated, and summarized. Full
   payloads are spilled to disk and referenced by handle so the context stays small.
3. **Fast & portable** - a Rust core (execution + protocols + summarization) exposed to
   a thin TypeScript MCP layer via [napi-rs](https://napi.rs/).
4. **Both ad-hoc and reusable** - agents can fire one-off requests *or* create, save, and
   re-run declarative collections stored as files.

## Documents

| Doc | Contents |
| --- | --- |
| [architecture.md](./architecture.md) | System design, the Rust/TS split, module layout, streaming strategy, FFI boundary |
| [features.md](./features.md) | Full feature list by protocol + cross-cutting features (auth, vars, assertions, token optimizer) |
| [mcp-tools.md](./mcp-tools.md) | The MCP tool surface: names, inputs, outputs, examples |
| [collection-format.md](./collection-format.md) | The declarative YAML/JSON test/collection format |
| [roadmap.md](./roadmap.md) | Phased delivery plan from scaffolding to gRPC and CI |

## Decisions locked in

- **Stack**: Rust core via napi-rs + TypeScript MCP layer (`@modelcontextprotocol/sdk`).
- **Distribution**: local dev tool over stdio transport (used by Cursor/Windsurf/Claude Desktop).
- **Test definition**: both ad-hoc agent calls *and* persisted declarative collections.
- **MVP protocols**: REST, GraphQL, WebSocket, SSE. gRPC is a later phase.
