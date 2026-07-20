export const metadata = {
  title: "Quick start - Volley",
};

export default function DocsQuickstartPage() {
  return (
    <>
      <h1>Quick start</h1>
      <p className="lead">
        Fire your first request, chain a token into a protected call, then drill into a
        large response - all within a small token budget.
      </p>

      <h2>1. Send a REST request</h2>
      <p>
        Ask the agent to call <code>http_request</code>. The tool returns a token-efficient
        summary by default; full payloads are referenced by a handle.
      </p>
      <pre>
        <code>{`{
  "tool": "http_request",
  "input": {
    "method": "POST",
    "url": "https://api.example.com/login",
    "headers": { "Content-Type": "application/json" },
    "body": { "user": "a", "pass": "{{secret_pass}}" },
    "assert": [{ "status": 200 }, { "jsonpath": "$.token", "exists": true }],
    "extract": { "token": "$.token" }
  }
}`}</code>
      </pre>
      <p>Response:</p>
      <pre>
        <code>{`{
  "status": 200,
  "timeMs": 142,
  "assertions": { "passed": 2, "failed": 0 },
  "extracted": { "token": "***redacted***" },
  "bodySummary": { "type": "object", "keys": ["token", "expiresIn"] },
  "responseHandle": "resp_a1b2"
}`}</code>
      </pre>

      <h2>2. Chain the token into a protected call</h2>
      <p>
        Extracted values become <code>{"{{vars}}"}</code> you can reuse in later calls.
        The agent does not need to copy-paste anything.
      </p>
      <pre>
        <code>{`{
  "tool": "http_request",
  "input": {
    "url": "https://api.example.com/me",
    "auth": { "type": "bearer", "token": "{{token}}" }
  }
}`}</code>
      </pre>

      <h2>3. Inspect a large response</h2>
      <p>
        When a response is too large to inline, pass the handle to
        <code>inspect_response</code> with an RFC 9535 JSONPath. Filters and
        <code>maxItems</code> truncation keep the output small.
      </p>
      <pre>
        <code>{`{
  "tool": "inspect_response",
  "input": {
    "handle": "resp_a1b2",
    "jsonpath": "$.items[?@.id==1]",
    "maxItems": 5
  }
}`}</code>
      </pre>

      <h2>4. Discover a GraphQL schema</h2>
      <p>
        <code>graphql_introspect</code> returns an enriched schema: field signatures,
        one-level nested fields, inline input types, and enum values - so the agent can
        pick operations without pasting docs.
      </p>
      <pre>
        <code>{`{
  "tool": "graphql_introspect",
  "input": { "url": "https://api.example.com/graphql" }
}`}</code>
      </pre>

      <h2>5. Open a WebSocket session</h2>
      <p>
        Bounded sessions connect, send messages, and collect frames until a stop
        condition - then return a summarized batch with assertion results.
      </p>
      <pre>
        <code>{`{
  "tool": "ws_session",
  "input": {
    "url": "wss://stream.example.com",
    "send": [{ "json": { "type": "subscribe", "topic": "prices" } }],
    "collect": { "maxMessages": 20, "maxDurationMs": 5000 },
    "assert": [{ "anyFrame": { "jsonpath": "$.type", "equals": "ack" } }]
  }
}`}</code>
      </pre>

      <blockquote>
        Ready for the full surface? See <a href="/docs/tools">MCP tools</a>.
      </blockquote>
    </>
  );
}
