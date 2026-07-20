export const metadata = {
  title: "Architecture - Volley",
};

export default function DocsArchitecturePage() {
  return (
    <>
      <h1>Architecture</h1>
      <p className="lead">
        A Rust core (execution + protocols + summarization) exposed to a thin TypeScript
        MCP layer via napi-rs. The FFI contract is JSON-string in / JSON-string out.
      </p>

      <h2>High-level split</h2>
      <ul>
        <li>
          <strong><code>crates/core</code></strong> - the Rust engine, compiled to a
          <code>.node</code> addon via napi-rs. Handles HTTP, GraphQL, WebSocket, SSE,
          assertions, templating, environments, the token optimizer, and the response
          store.
        </li>
        <li>
          <strong><code>packages/mcp-server</code></strong> - the TypeScript MCP server
          (stdio transport). Tools live in <code>src/tools/</code>;
          <code>src/native.ts</code> is the typed wrapper over the addon.
        </li>
        <li>
          <strong><code>scripts/e2e.mjs</code></strong> - end-to-end stdio verification
          (31 checks) that spins up a local test server and drives every tool.
        </li>
      </ul>

      <h2>FFI boundary</h2>
      <ul>
        <li>The Rust core must <strong>never write to stdout</strong> - stdout is the MCP JSON-RPC channel. Use stderr for diagnostics.</li>
        <li>Cross the FFI boundary with JSON strings; keep <code>camelCase</code> on the wire (serde <code>rename_all = &quot;camelCase&quot;</code>) so it matches the TypeScript types.</li>
        <li>Every new core function is surfaced in <code>packages/mcp-server/src/native.ts</code> with an explicit TypeScript signature.</li>
      </ul>

      <h2>Streaming strategy</h2>
      <p>
        Bounded sessions (<code>ws_session</code>, <code>sse_session</code>) collect frames
        or events until a stop condition (max messages / max duration / matcher), then
        return a summarized batch. Persistent handles (<code>ws_open</code> /
        <code>ws_send</code> / <code>ws_recv</code> / <code>ws_close</code>) keep a live
        connection buffered on the Rust side for interactive flows.
      </p>

      <h2>Token optimizer</h2>
      <p>
        Every response is filtered, truncated, and summarized before it reaches the agent.
        Full payloads are spilled to an in-memory store and referenced by a
        <code>responseHandle</code>. The agent escalates with
        <code>inspect_response</code> + a JSONPath when it needs more - paying only for the
        bytes it actually reads.
      </p>

      <h2>napi-rs notes</h2>
      <ul>
        <li>Uses napi-rs v3 (<code>napi</code> / <code>napi-derive</code> = &quot;3&quot;); <code>napi-build</code> stays &quot;2.3&quot; (v3-compatible).</li>
        <li><code>napi build --platform</code> targets the host architecture and writes the addon plus generated <code>index.js</code> / <code>index.d.ts</code> into <code>crates/core/</code>.</li>
        <li>If generated <code>index.d.ts</code> looks stale, the crate&apos;s per-target incremental cache is the cause; a clean rebuild regenerates the type defs.</li>
      </ul>
    </>
  );
}
