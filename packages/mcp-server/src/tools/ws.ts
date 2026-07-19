import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { wsOpen, wsSend, wsRecv, wsClose } from "../native.js";
import type { Session } from "../session.js";

function textResult(session: Session, obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(session.redact(obj), null, 2) }] };
}

export function registerWsTools(server: McpServer, session: Session): void {
  server.registerTool(
    "ws_open",
    {
      title: "Open persistent WebSocket",
      description: "Open long-lived WS, return handle. Use ws_send/ws_recv/ws_close to interact.",
      inputSchema: {
        url: z.string().describe("ws:// or wss:// URL. May contain {{variables}}."),
        headers: z.record(z.string(), z.any()).optional(),
        subprotocols: z.array(z.string()).optional(),
        send: z
          .array(z.object({ json: z.any().optional(), text: z.string().optional() }))
          .optional()
          .describe("Messages to send immediately after connecting."),
        env: z.string().optional(),
      },
    },
    async (args) => {
      const spec = { ...args, vars: session.mergedVars(args.env) };
      const policy = session.checkPolicy(String(args.url ?? ""));
      if (policy && "blocked" in policy) {
        return textResult(session, { ok: false, connected: false, error: policy.error });
      }
      if (policy && "dryRun" in policy) {
        return textResult(session, policy.result);
      }
      const result = await wsOpen(spec);
      return textResult(session, result);
    },
  );

  server.registerTool(
    "ws_send",
    {
      title: "Send WebSocket message",
      description: "Send a single message on a persistent WebSocket connection opened with ws_open.",
      inputSchema: {
        handle: z.string().describe("Handle returned by ws_open."),
        json: z.any().optional().describe("Send as a JSON message (mutually exclusive with text)."),
        text: z.string().optional().describe("Send as a raw text message."),
      },
    },
    async ({ handle, json, text }) => {
      const message = json !== undefined ? { json } : { text };
      const result = wsSend(handle, message);
      return textResult(session, result);
    },
  );

  server.registerTool(
    "ws_recv",
    {
      title: "Receive WebSocket frames",
      description: "Drain buffered frames from persistent WS. Blocks up to maxDurationMs for first frame.",
      inputSchema: {
        handle: z.string().describe("Handle returned by ws_open."),
        maxMessages: z.number().int().positive().optional().describe("Max frames to drain (default 50)."),
        maxDurationMs: z.number().int().positive().optional().describe("Max wait for the first frame (default 1000ms)."),
      },
    },
    async (args) => {
      const result = await wsRecv(args);
      return textResult(session, result);
    },
  );

  server.registerTool(
    "ws_close",
    {
      title: "Close persistent WebSocket",
      description: "Close a persistent WebSocket connection and release its handle.",
      inputSchema: {
        handle: z.string().describe("Handle returned by ws_open."),
      },
    },
    async ({ handle }) => {
      const result = wsClose(handle);
      return textResult(session, result);
    },
  );
}
