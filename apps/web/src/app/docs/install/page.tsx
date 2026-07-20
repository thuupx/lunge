export const metadata = {
  title: "Install — Volley",
};

export default function DocsInstallPage() {
  return (
    <>
      <h1>Install</h1>
      <p className="lead">
        Volley ships as an npm package. Add it to any MCP-capable client and every
        agent you run gets a full API testing toolkit — no GUI, no copy-paste, no
        context bloat.
      </p>

      <h2>Option 1: npx (recommended)</h2>
      <p>
        The simplest setup. Your MCP client runs <code>npx -y @thupham/volley-mcp</code> which
        downloads the latest version on first use and caches it. No global install
        needed.
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "volley": {
      "command": "npx",
      "args": ["-y", "@thupham/volley-mcp"]
    }
  }
}`}</code>
      </pre>

      <h2>Option 2: global install</h2>
      <p>Install once, reference the binary directly:</p>
      <pre>
        <code>{`npm install -g @thupham/volley-mcp

# then in your MCP client config:
{
  "mcpServers": {
    "volley": {
      "command": "volley-mcp"
    }
  }
}`}</code>
      </pre>

      <h2>Client config file locations</h2>
      <ul>
        <li><strong>Cursor</strong> — <code>~/.cursor/mcp.json</code> or project <code>.cursor/mcp.json</code></li>
        <li><strong>Windsurf</strong> — <code>~/.codeium/windsurf/mcp_config.json</code></li>
        <li><strong>Claude Desktop</strong> — <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
        <li><strong>Devin CLI</strong> — <code>~/.config/devin/config.json</code></li>
        <li><strong>VS Code</strong> — <code>~/.vscode/mcp.json</code> or project <code>.vscode/mcp.json</code></li>
      </ul>

      <h2>Verify the connection</h2>
      <p>
        Restart your client and ask the agent to list available tools. You should see
        <code>http_request</code>, <code>graphql_request</code>, <code>ws_session</code>,
        <code>sse_session</code>, <code>inspect_response</code>, and the rest of the
        surface described in <a href="/docs/tools">MCP tools</a>.
      </p>

      <blockquote>
        Tip: the <code>bin</code> name is <code>volley-mcp</code>. When you run
        <code>npx -y @thupham/volley-mcp</code>, npx invokes the <code>volley-mcp</code>
        binary automatically.
      </blockquote>

      <h2>From source (development)</h2>
      <p>If you want to hack on Volley itself or run a local build:</p>
      <pre>
        <code>{`git clone <repo>
cd volley
pnpm install
pnpm build   # builds the Rust core, then the TS server`}</code>
      </pre>
      <p>
        Then point your MCP client at the local build:
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "volley": {
      "command": "node",
      "args": ["/absolute/path/to/volley/packages/mcp-server/dist/index.js"]
    }
  }
}`}</code>
      </pre>

      <h2>End-to-end verification</h2>
      <p>To confirm the full pipeline locally without an MCP client, run the bundled e2e script:</p>
      <pre>
        <code>{`pnpm build
pnpm e2e   # spins up a local test server and drives every tool over stdio`}</code>
      </pre>
      <p>
        The script runs 31 checks covering every shipped tool. If it passes, your build is
        ready to register with any MCP client.
      </p>
    </>
  );
}
