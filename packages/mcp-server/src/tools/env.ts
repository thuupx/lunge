import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.js";

export function registerEnvTools(server: McpServer, session: Session): void {
  server.registerTool(
    "set_env",
    {
      title: "Set environment variables",
      description: "Create/update named env. Values may be {value, secret:true}. Use via {{name}}.",
      inputSchema: {
        name: z.string().describe("Environment name, e.g. 'dev'."),
        vars: z
          .record(z.string(), z.any())
          .describe("Map of variables. Use { value, secret: true } to mark secrets."),
      },
    },
    async ({ name, vars }) => {
      session.setEnv(name, vars as Record<string, unknown>);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ env: name, vars: session.describeEnv(name) }, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "list_envs",
    {
      title: "List environments",
      description: "List env names and (masked) variables of the active or specified one.",
      inputSchema: { name: z.string().optional().describe("Show variables for this env.") },
    },
    async ({ name }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ envs: session.listEnvs(), vars: session.describeEnv(name) }, null, 2),
        },
      ],
    }),
  );
}
