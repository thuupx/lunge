import { CodeBlock } from "@/components/code-block";

export const metadata = {
  title: "Collections - Volley",
};

export default function DocsCollectionsPage() {
  return (
    <>
      <h1>Collections</h1>
      <p className="lead">
        Both ad-hoc agent calls and persisted declarative collections. Collections are
        plain YAML or JSON files - git-friendly, diffable, and shareable.
      </p>

      <h2>Why collections</h2>
      <p>
        Ad-hoc tool calls are great for exploration, but teams also need repeatable test
        suites. Volley collections let you define ordered steps once and re-run them with
        a single tool call. Variables thread from one step to the next; assertions gate
        execution; <code>only</code> and <code>tags</code> filter runs.
      </p>

      <h2>Format</h2>
      <p>
        A collection is a list of named steps. Each step is a tool invocation with inputs,
        optional assertions, and optional extractions. The runner threads extracted values
        into the next step&apos;s inputs.
      </p>
      <CodeBlock
        language="yaml"
        code={`# collections/login-flow.yaml
name: Login flow
steps:
  - name: login
    tool: http_request
    input:
      method: POST
      url: "{{baseUrl}}/login"
      body: { user: "a", pass: "{{secret_pass}}" }
    extract: { token: "$.token" }

  - name: me
    tool: http_request
    input:
      url: "{{baseUrl}}/me"
      auth: { type: bearer, token: "{{token}}" }
    assert: [{ status: 200 }]

  - name: invoices
    tool: http_request
    input:
      url: "{{baseUrl}}/invoices"
      auth: { type: bearer, token: "{{token}}" }
      query: { limit: 10 }
    extract: { firstInvoiceId: "$.items[0].id" }`}
      />

      <h2>Running a collection</h2>
      <CodeBlock
        language="json"
        code={`{
  "tool": "run_collection",
  "input": {
    "path": "collections/login-flow.yaml",
    "env": "dev",
    "tags": ["smoke"]
  }
}`}
      />
      <p>
        Output is a per-step summary: status, assertions, extracted vars, and handles -
        same token-efficient shape as individual tool calls.
      </p>

      <h2>Listing collections</h2>
      <CodeBlock
        language="json"
        code={`{ "tool": "list_collections", "input": {} }`}
      />

      <h2>Filters</h2>
      <ul>
        <li>
          <strong><code>only</code></strong> - run only the named step(s).
        </li>
        <li>
          <strong><code>tags</code></strong> - run only steps tagged with any of the given tags.
        </li>
        <li>
          <strong><code>env</code></strong> - resolve <code>{"{{vars}}"}</code> against a named environment.
        </li>
      </ul>

      <blockquote>
        Collections are the bridge between one-off agent exploration and repeatable,
        reviewable test suites - all behind the same MCP tool surface.
      </blockquote>
    </>
  );
}
