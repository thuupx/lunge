import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wsSession, sseSession } from "../native.js";
import { formatWs, formatSse } from "../format.js";
import type { Session, Verbosity } from "../session.js";

const verbosity = z.enum(["summary", "headers", "full"]).optional();

function textResult(session: Session, obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(session.redact(obj), null, 2) }] };
}

export function registerStreamTools(server: McpServer, session: Session): void {
  server.registerTool(
    "ws_session",
    {
      title: "WebSocket session (bounded)",
      description: "Connect WS, send messages, collect frames until stop condition. Returns summarized batch.",
      inputSchema: {
        url: z.string().describe("ws:// or wss:// URL."),
        headers: z.record(z.string(), z.any()).optional(),
        subprotocols: z.array(z.string()).optional(),
        send: z
          .array(z.object({ json: z.any().optional(), text: z.string().optional() }))
          .optional()
          .describe("Messages to send after connecting."),
        collect: z
          .object({
            maxMessages: z.number().int().positive().optional(),
            maxDurationMs: z.number().int().positive().optional(),
            until: z.record(z.string(), z.any()).optional().describe("Stop when a frame matches, e.g. {jsonpath:'$.type',equals:'done'}."),
          })
          .optional(),
        assert: z.array(z.record(z.string(), z.any())).optional().describe("e.g. [{anyFrame:{jsonpath:'$.type',equals:'ack'}},{frameCount:{gte:1}}]"),
        env: z.string().optional(),
        verbosity,
      },
    },
    async (args) => {
      const spec = { ...args, vars: session.mergedVars(args.env) };
      const policy = session.checkPolicy(String(args.url ?? ""));
      if (policy && "blocked" in policy) {
        return textResult(session, { ok: false, connected: false, error: policy.error });
      }
      if (policy && "dryRun" in policy) {
        const handle = session.storeResponse(policy.result);
        return textResult(session, formatWs(policy.result, (args.verbosity as Verbosity) ?? "summary", handle));
      }
      const result = await wsSession(spec);
      const handle = session.storeResponse(result);
      return textResult(session, formatWs(result, (args.verbosity as Verbosity) ?? "summary", handle));
    },
  );

  server.registerTool(
    "sse_session",
    {
      title: "SSE session (bounded)",
      description: "Subscribe to SSE, collect events until stop condition. Returns summarized batch with assertions.",
      inputSchema: {
        url: z.string().describe("SSE endpoint URL."),
        headers: z.record(z.string(), z.any()).optional(),
        collect: z
          .object({
            maxEvents: z.number().int().positive().optional(),
            maxDurationMs: z.number().int().positive().optional(),
          })
          .optional(),
        assert: z.array(z.record(z.string(), z.any())).optional().describe("e.g. [{anyEvent:{jsonpath:'$.type',equals:'tick'}},{eventCount:{gte:1}}]"),
        env: z.string().optional(),
        verbosity,
      },
    },
    async (args) => {
      const spec = { ...args, vars: session.mergedVars(args.env) };
      const policy = session.checkPolicy(String(args.url ?? ""));
      if (policy && "blocked" in policy) {
        return textResult(session, { ok: false, connected: false, error: policy.error });
      }
      if (policy && "dryRun" in policy) {
        const handle = session.storeResponse(policy.result);
        return textResult(session, formatSse(policy.result, (args.verbosity as Verbosity) ?? "summary", handle));
      }
      const result = await sseSession(spec);
      const handle = session.storeResponse(result);
      return textResult(session, formatSse(result, (args.verbosity as Verbosity) ?? "summary", handle));
    },
  );
}
