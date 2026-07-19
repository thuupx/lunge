import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Session } from "../session.js";

export function registerPolicyTool(server: McpServer, session: Session): void {
  server.registerTool(
    "set_policy",
    {
      title: "Set request policy",
      description: "Configure host allow/deny lists + dry-run mode. Glob patterns: *, *.example.com.",
      inputSchema: {
        allow: z.array(z.string()).optional().describe("Allowed host patterns. Empty = allow any non-denied host."),
        deny: z.array(z.string()).optional().describe("Denied host patterns; takes precedence over allow."),
        dryRun: z.boolean().optional().describe("If true, validate requests but do not send them."),
      },
    },
    async (args) => {
      if (args.allow !== undefined) session.policy.allow = args.allow;
      if (args.deny !== undefined) session.policy.deny = args.deny;
      if (args.dryRun !== undefined) session.policy.dryRun = args.dryRun;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { policy: { allow: session.policy.allow, deny: session.policy.deny, dryRun: session.policy.dryRun } },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
