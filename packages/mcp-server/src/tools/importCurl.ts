import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseCurl } from "../curl.js";
import { httpRequest } from "../native.js";
import { formatHttp } from "../format.js";
import type { Session, Verbosity } from "../session.js";

export function registerImportCurlTool(server: McpServer, session: Session): void {
  server.registerTool(
    "import_curl",
    {
      title: "Import a curl command",
      description: "Parse curl into structured request. Optionally execute it.",
      inputSchema: {
        curl: z.string().describe("The full curl command, e.g. \"curl -X POST https://... -H '...' -d '...'\"."),
        execute: z.boolean().optional().describe("If true, run the parsed request and return the result."),
        verbosity: z.enum(["summary", "headers", "full"]).optional(),
      },
    },
    async ({ curl, execute, verbosity }) => {
      const parsed = parseCurl(curl);
      if (!execute) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ parsed }, null, 2) }] };
      }
      const policy = session.checkPolicy(parsed.url);
      if (policy && "blocked" in policy) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: policy.error }, null, 2) }] };
      }
      if (policy && "dryRun" in policy) {
        const handle = session.storeResponse(policy.result);
        const formatted = formatHttp(policy.result, (verbosity as Verbosity) ?? "summary", handle);
        return { content: [{ type: "text" as const, text: JSON.stringify(session.redact({ parsed, result: formatted }), null, 2) }] };
      }
      const result = await httpRequest({ ...parsed, vars: session.mergedVars() });
      const handle = session.storeResponse(result);
      const formatted = formatHttp(result, (verbosity as Verbosity) ?? "summary", handle);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(session.redact({ parsed, result: formatted }), null, 2) }],
      };
    },
  );
}
