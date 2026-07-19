import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { graphqlIntrospect } from "../native.js";
import type { Session } from "../session.js";

const authSchema = z
  .object({
    type: z.enum(["bearer", "basic", "apikey"]),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    key: z.string().optional(),
    value: z.string().optional(),
    in: z.enum(["header", "query"]).optional(),
  })
  .optional();

export function registerGraphqlTools(server: McpServer, session: Session): void {
  server.registerTool(
    "graphql_introspect",
    {
      title: "GraphQL introspection",
      description: "Introspect GraphQL endpoint, return summarized schema with field signatures (args + return types) and input types.",
      inputSchema: {
        url: z.string().describe("GraphQL endpoint URL."),
        headers: z.record(z.string(), z.any()).optional(),
        auth: authSchema,
        env: z.string().optional(),
        timeoutMs: z.number().int().positive().optional(),
      },
    },
    async (args) => {
      const spec = { ...args, vars: session.mergedVars(args.env) };
      const result = await graphqlIntrospect(spec);
      const handle = session.storeResponse(result);
      const out = result.error
        ? { ok: false, error: result.error }
        : {
            ok: result.ok,
            status: result.status,
            schema: result.schema,
            graphqlErrors: result.graphqlErrors,
            responseHandle: handle,
            hint: "Use inspect_response with this handle to drill into the raw introspection payload.",
          };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(session.redact(out), null, 2) }],
      };
    },
  );
}
