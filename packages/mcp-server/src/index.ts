#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Session } from "./session.js";
import { coreVersion } from "./native.js";
import { registerRequestTools } from "./tools/request.js";
import { registerStreamTools } from "./tools/stream.js";
import { registerInspectTool } from "./tools/inspect.js";
import { registerEnvTools } from "./tools/env.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerImportCurlTool } from "./tools/importCurl.js";
import { registerGraphqlTools } from "./tools/graphql.js";
import { registerWsTools } from "./tools/ws.js";
import { registerSaveTool } from "./tools/save.js";
import { registerPolicyTool } from "./tools/policy.js";
import { registerImporterTools } from "./tools/importers.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: "volley", version: "1.0.6" });
  const session = new Session();

  registerRequestTools(server, session);
  registerStreamTools(server, session);
  registerInspectTool(server, session);
  registerEnvTools(server, session);
  registerCollectionTools(server, session);
  registerImportCurlTool(server, session);
  registerGraphqlTools(server, session);
  registerWsTools(server, session);
  registerSaveTool(server, session);
  registerPolicyTool(server, session);
  registerImporterTools(server);

  // stdout is reserved for the MCP JSON-RPC stream; log to stderr only.
  process.stderr.write(`volley starting (core v${coreVersion()})\n`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
