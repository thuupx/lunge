import { CodeBlock } from "@/components/code-block";

export const metadata = {
  title: "Install - Lunge",
};

export default function DocsInstallPage() {
  return (
    <>
      <h1>Install</h1>
      <p className="lead">
        Lunge ships as an npm package and is listed on the{" "}
        <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
          MCP Registry
        </a>{" "}
        (<code>io.github.thuupx/lunge</code>). Add it to any MCP-capable client and every
        agent you run gets an advanced API client - execute requests, run assertions,
        extract variables, replay collections - no GUI, no copy-paste, no context bloat.
      </p>

      <h2>Option 1: MCP Registry</h2>
      <p>
        Lunge is listed on the{" "}
        <a href="https://registry.modelcontextprotocol.io/?q=lunge" target="_blank" rel="noopener noreferrer">
          MCP Registry
        </a>{" "}
        (<code>io.github.thuupx/lunge</code>). Install via CLI tools that read the registry:
      </p>
      <CodeBlock language="bash" code={`# Via mcpm CLI
mcpm install io.github.thuupx/lunge

# Or via mcp-registry CLI
npx mcp-registry-cli install io.github.thuupx/lunge`} />

      <h2>Option 2: npx (recommended for manual config)</h2>
      <p>
        The simplest setup. Your MCP client runs <code>npx -y lunge-mcp</code> which
        downloads the latest version on first use and caches it. No global install
        needed.
      </p>
      <CodeBlock
        language="json"
        code={`{
  "mcpServers": {
    "lunge": {
      "command": "npx",
      "args": ["-y", "lunge-mcp"]
    }
  }
}`}
      />

      <h2>Option 3: global install</h2>
      <p>Install once, reference the binary directly:</p>
      <CodeBlock language="bash" code={`npm install -g lunge-mcp`} />
      <p>Then in your MCP client config:</p>
      <CodeBlock
        language="json"
        code={`{
  "mcpServers": {
    "lunge": {
      "command": "lunge"
    }
  }
}`}
      />

      <h2>Client config file locations</h2>
      <ul>
        <li><strong>Cursor</strong> - <code>~/.cursor/mcp.json</code> or project <code>.cursor/mcp.json</code></li>
        <li><strong>Devin Desktop</strong> - <code>~/.codeium/mcp_config.json</code></li>
        <li><strong>Claude Desktop</strong> - <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
        <li><strong>Devin CLI</strong> - <code>~/.config/devin/config.json</code></li>
        <li><strong>VS Code</strong> - <code>~/.vscode/mcp.json</code> or project <code>.vscode/mcp.json</code></li>
      </ul>

      <h2>Verify the connection</h2>
      <p>
        Restart your client and ask the agent to list available tools. You should see
        <code>http_request</code>, <code>graphql_request</code>, <code>ws_session</code>,
        <code>sse_session</code>, <code>inspect_response</code>, and the rest of the
        surface described in <a href="/docs/tools">MCP tools</a>.
      </p>

      <h2>From source (development)</h2>
      <p>If you want to hack on Lunge itself or run a local build:</p>
      <CodeBlock
        language="bash"
        code={`git clone https://github.com/thuupx/lunge.git
cd lunge
pnpm install
pnpm build`}
      />
      <p>Then point your MCP client at the local build:</p>
      <CodeBlock
        language="json"
        code={`{
  "mcpServers": {
    "lunge": {
      "command": "node",
      "args": ["/absolute/path/to/lunge/packages/mcp-server/dist/index.js"]
    }
  }
}`}
      />

      <h2>End-to-end verification</h2>
      <p>To confirm the full pipeline locally without an MCP client, run the bundled e2e script:</p>
      <CodeBlock
        language="bash"
        code={`pnpm build
pnpm e2e`}
      />
      <p>
        The script runs all checks covering every shipped tool. If it passes, your build is
        ready to register with any MCP client.
      </p>
    </>
  );
}
