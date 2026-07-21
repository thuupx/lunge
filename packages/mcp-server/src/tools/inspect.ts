import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonQuery } from "../native.js";
import type { Session } from "../session.js";

/** Truncate arrays to maxItems, adding a truncation marker. Strings are capped at maxStr chars. */
function truncate(value: unknown, maxItems: number, maxStr: number): { value: unknown; truncated: boolean } {
  if (Array.isArray(value)) {
    if (value.length <= maxItems) return { value, truncated: false };
    return {
      value: [...value.slice(0, maxItems), `…(+${value.length - maxItems} more, use a narrower jsonpath)`],
      truncated: true,
    };
  }
  if (typeof value === "string" && value.length > maxStr) {
    return { value: value.slice(0, maxStr) + `…(+${value.length - maxStr} chars)`, truncated: true };
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let anyTruncated = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const r = truncate(v, maxItems, maxStr);
      if (r.truncated) anyTruncated = true;
      out[k] = r.value;
    }
    return { value: out, truncated: anyTruncated };
  }
  return { value, truncated: false };
}

export function registerInspectTool(server: McpServer, session: Session): void {
  server.registerTool(
    "inspect_response",
    {
      title: "Inspect a stored response",
      description:
        "Drill into a stored response by handle without re-running the request. " +
        "Use jsonpath to pull only the slice you need. Supports RFC 9535 filters " +
        "($.items[?@.id==1]) and slices ($.items[0:5]). Use double quotes in filters. " +
        "Omit jsonpath to return the full stored body — for graphql_introspect this is the enriched `schema` " +
        "(so $.queries, $.mutations, $.inputTypes work directly); for ws_session it's the `frames` array; " +
        "for sse_session it's the `events` array; otherwise it's the parsed bodyJson/bodyText.",
      inputSchema: {
        handle: z.string().describe("responseHandle from a prior tool call."),
        jsonpath: z
          .string()
          .optional()
          .describe("RFC 9535 JSONPath. Filters need double quotes: [?@.name==\"x\"]. Omit for full body."),
        maxItems: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Cap array elements returned (default 50). Excess shown as truncation marker."),
        maxStr: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Cap string length in chars (default 2000)."),
      },
    },
    async ({ handle, jsonpath, maxItems, maxStr }) => {
      const stored = session.getStored(handle);
      if (!stored) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `unknown handle: ${handle}` }],
        };
      }
      // For introspect results, prefer the enriched `schema` field over raw `bodyJson`
      // so the agent can query $.queries, $.mutations, $.inputTypes directly.
      const body =
        stored.schema ??
        stored.bodyJson ??
        stored.bodyText ??
        stored.frames ??
        stored.events ??
        null;
      if (jsonpath) {
        const result = jsonQuery(body, jsonpath);
        if (result.error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `jsonpath error: ${result.error}` }],
          };
        }
        if (!result.found) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ found: false, hint: "path matched nothing" }) }],
          };
        }
        const cap = maxItems ?? 50;
        const strCap = maxStr ?? 2000;
        const { value, truncated } = truncate(result.value, cap, strCap);
        const out: Record<string, unknown> = { found: true, value };
        if (truncated) out.truncated = true;
        return { content: [{ type: "text" as const, text: JSON.stringify(session.redact(out), null, 2) }] };
      }
      // No jsonpath: return full body, but still cap arrays/strings.
      const cap = maxItems ?? 50;
      const strCap = maxStr ?? 2000;
      const { value, truncated } = truncate(body, cap, strCap);
      const out: Record<string, unknown> = { found: true, value };
      if (truncated) out.truncated = true;
      return { content: [{ type: "text" as const, text: JSON.stringify(session.redact(out), null, 2) }] };
    },
  );
}
