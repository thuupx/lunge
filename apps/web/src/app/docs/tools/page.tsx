import { ToolsExplorer } from "@/components/tools-explorer";

export const metadata = {
  title: "MCP tools - Lunge",
};

export default function DocsToolsPage() {
  return (
    <>
      <h1>MCP tool surface</h1>
      <p className="lead">
        The tool API the agent sees. Design principles: a few powerful tools rather than
        many narrow ones, summary-first output, and handles over payloads.
      </p>

      <h2>Principles</h2>
      <ul>
        <li>
          <strong>Few, powerful tools</strong> - keeps the agent&apos;s tool list small and the
          schema token cost low.
        </li>
        <li>
          <strong>Summary-first output</strong> - every tool defaults to
          <code>verbosity: &quot;summary&quot;</code>; the agent escalates with
          <code>inspect_response</code> when it needs more.
        </li>
        <li>
          <strong>Handles over payloads</strong> - large results are referenced by id, not
          inlined into the response.
        </li>
      </ul>

      <h2>Tools by category</h2>
      <p>
        Filter the surface by category. Each card shows the tool name, signature, and a
        short description.
      </p>

      <div className="mt-6">
        <ToolsExplorer />
      </div>

      <h2>Verbosity &amp; token optimization</h2>
      <ul>
        <li>
          <code>verbosity: full</code> is auto-downgraded to <code>summary</code> when
          <code>extract</code> is set - extracted values already contain the needed data.
        </li>
        <li>WS/SSE frame and event arrays are capped at 10 items in <code>full</code> verbosity with truncation markers.</li>
        <li>
          <code>graphql_introspect</code> returns enriched schemas: field signatures
          (<code>name(args): Type</code>), 1-level nested fields, inline input types, and
          enum values.
        </li>
        <li>
          <code>inspect_response</code> supports RFC 9535 JSONPath with filters
          (<code>$.items[?@.id==1]</code>), <code>maxItems</code> truncation, and surfaces
          parse errors. For introspection results it reads the enriched <code>schema</code>
          field, so <code>$.queries</code>, <code>$.mutations</code>, and
          <code>$.inputTypes</code> work directly.
        </li>
        <li>Tool descriptions are kept short to minimize <code>tools/list</code> token weight.</li>
      </ul>
    </>
  );
}
