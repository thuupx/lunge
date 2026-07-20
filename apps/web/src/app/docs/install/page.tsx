import { CodeBlock } from "@/components/code-block";

export const metadata = {
  title: "Install - Volley",
};

export default function DocsInstallPage() {
  return (
    <>
      <h1>Install</h1>
      <p className="lead">
        Volley ships as a single stdio MCP server. Install the package, point your MCP
        client at the built entry, and every agent you run gets a full API testing toolkit.
      </p>

      <h2>Prerequisites</h2>
      <ul>
        <li>Node.js 18 or newer.</li>
        <li>pnpm (the monorepo uses pnpm workspaces).</li>
        <li>An MCP-capable client: Cursor, Windsurf, Claude Desktop, or any stdio MCP host.</li>
      </ul>

      <h2>1. Build the server</h2>
      <p>Clone the repo and build the Rust core plus the TypeScript MCP layer:</p>
      <CodeBlock
        language="bash"
        code={`git clone <repo>
cd volley
pnpm install
pnpm build   # builds the Rust core, then the TS server`}
      />
      <p>
        The build produces <code>packages/mcp-server/dist/index.js</code> - the stdio
        entry point your MCP client will launch.
      </p>

      <h2>2. Register the server with your client</h2>
      <p>
        Add a <code>volley</code> entry to your client&apos;s MCP server config. The exact file
        depends on the client:
      </p>
      <ul>
        <li><strong>Cursor</strong> - <code>~/.cursor/mcp.json</code> or project <code>.cursor/mcp.json</code></li>
        <li><strong>Windsurf</strong> - <code>~/.codeium/windsurf/mcp_config.json</code></li>
        <li><strong>Claude Desktop</strong> - <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
        <li><strong>Devin CLI</strong> - <code>~/.config/devin/config.json</code></li>
      </ul>

      <CodeBlock
        language="json"
        code={`{
  "mcpServers": {
    "volley": {
      "command": "node",
      "args": ["/absolute/path/to/volley/packages/mcp-server/dist/index.js"]
    }
  }
}`}
      />

      <h2>3. Verify the connection</h2>
      <p>
        Restart your client and ask the agent to list available tools. You should see
        <code>http_request</code>, <code>graphql_request</code>, <code>ws_session</code>,
        <code>sse_session</code>, <code>inspect_response</code>, and the rest of the
        surface described in <a href="/docs/tools">MCP tools</a>.
      </p>

      <blockquote>
        Tip: use an absolute path for <code>args</code>. Some clients resolve relative
        paths against unexpected working directories.
      </blockquote>

      <h2>End-to-end verification</h2>
      <p>To confirm the full pipeline locally without an MCP client, run the bundled e2e script:</p>
      <CodeBlock
        language="bash"
        code={`pnpm build
pnpm e2e   # spins up a local test server and drives every tool over stdio`}
      />
      <p>
        The script runs 31 checks covering every shipped tool. If it passes, your build is
        ready to register with any MCP client.
      </p>
    </>
  );
}
