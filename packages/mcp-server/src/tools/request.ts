import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { httpRequest, graphqlRequest } from "../native.js";
import { formatHttp } from "../format.js";
import type { Session, Verbosity } from "../session.js";

const verbosity = z
  .enum(["summary", "headers", "full"])
  .optional()
  .describe("summary (default, token-efficient), headers, or full. Auto-downgraded to summary when extract is set.");

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

const assertSchema = z
  .array(z.record(z.string(), z.any()))
  .optional()
  .describe("e.g. [{status:200},{jsonpath:'$.x',equals:1},{timeMs:{lt:500}}].");

function textResult(session: Session, obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(session.redact(obj), null, 2) }] };
}

/** Auto-downgrade full→summary when extract is set (extracted values already contain the needed data). */
function effectiveVerbosity(v: unknown, hasExtract: boolean): Verbosity {
  const verbosity = (v as Verbosity) ?? "summary";
  if (hasExtract && verbosity === "full") return "summary";
  return verbosity;
}

export function registerRequestTools(server: McpServer, session: Session): void {
  server.registerTool(
    "http_request",
    {
      title: "HTTP request",
      description: "REST/HTTP request with auth, assertions, {{var}} extraction. Returns token-efficient summary.",
      inputSchema: {
        method: z.string().optional().describe("HTTP method (default GET)."),
        url: z.string().describe("Full URL. May contain {{variables}}."),
        headers: z.record(z.string(), z.any()).optional(),
        query: z.record(z.string(), z.any()).optional(),
        body: z.any().optional().describe("Request body (object=json, string=text)."),
        bodyType: z.enum(["json", "form", "text", "raw"]).optional().describe("Default json."),
        auth: authSchema,
        assert: assertSchema,
        extract: z
          .record(z.string(), z.string())
          .optional()
          .describe("Capture vars: { token: '$.token' }. Use via {{token}} later."),
        env: z.string().optional().describe("Environment name for variable resolution."),
        timeoutMs: z.number().int().positive().optional(),
        followRedirects: z.boolean().optional(),
        verbosity,
      },
    },
    async (args) => {
      const { env, verbosity, ...rest } = args;
      const spec = { ...rest, vars: session.mergedVars(env) };
      const url = String(rest.url ?? "");
      const policy = session.checkPolicy(url);
      if (policy && "blocked" in policy) {
        return textResult(session, { ok: false, error: policy.error });
      }
      const hasExtract = !!rest.extract && Object.keys(rest.extract as object).length > 0;
      const vb = effectiveVerbosity(verbosity, hasExtract);
      session.recordRequest("http", rest as Record<string, unknown>, rest.assert as unknown[] | undefined, rest.extract as Record<string, string> | undefined);
      if (policy && "dryRun" in policy) {
        const handle = session.storeResponse(policy.result);
        return textResult(session, formatHttp(policy.result, vb, handle));
      }
      const result = await httpRequest(spec);
      session.applyExtracted(result.extracted);
      const handle = session.storeResponse(result);
      return textResult(session, formatHttp(result, vb, handle));
    },
  );

  server.registerTool(
    "graphql_request",
    {
      title: "GraphQL request",
      description:
        "GraphQL query/mutation over HTTP. Supports {{var}} extraction. " +
        "Note: `ok` reflects HTTP status only (200 = ok). GraphQL-level errors are returned in `graphqlErrors` — always check both. " +
        "Use extract with $.data.* for success data and $.errors.* for error details.",
      inputSchema: {
        url: z.string().describe("GraphQL endpoint URL."),
        query: z.string().describe("GraphQL query/mutation document."),
        variables: z.record(z.string(), z.any()).optional(),
        headers: z.record(z.string(), z.any()).optional(),
        auth: authSchema,
        assert: assertSchema,
        extract: z.record(z.string(), z.string()).optional().describe("Capture vars: { token: '$.data.login.accessToken' }."),
        env: z.string().optional(),
        timeoutMs: z.number().int().positive().optional(),
        verbosity,
      },
    },
    async (args) => {
      const { env, verbosity, ...rest } = args;
      const spec = { ...rest, vars: session.mergedVars(env) };
      const url = String(rest.url ?? "");
      const policy = session.checkPolicy(url);
      if (policy && "blocked" in policy) {
        return textResult(session, { ok: false, error: policy.error });
      }
      const hasExtract = !!rest.extract && Object.keys(rest.extract as object).length > 0;
      const vb = effectiveVerbosity(verbosity, hasExtract);
      session.recordRequest("graphql", rest as Record<string, unknown>, rest.assert as unknown[] | undefined, rest.extract as Record<string, string> | undefined);
      if (policy && "dryRun" in policy) {
        const handle = session.storeResponse(policy.result);
        return textResult(session, formatHttp(policy.result, vb, handle));
      }
      const result = await graphqlRequest(spec);
      session.applyExtracted(result.extracted);
      const handle = session.storeResponse(result);
      return textResult(session, formatHttp(result, vb, handle));
    },
  );
}
