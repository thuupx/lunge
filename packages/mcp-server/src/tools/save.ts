import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Session } from "../session.js";

interface Step {
  id?: string;
  type?: "http" | "graphql" | "ws" | "sse";
  request?: Record<string, unknown>;
  assert?: unknown[];
  extract?: Record<string, string>;
  tags?: string[];
  skip?: boolean;
  continueOnError?: boolean;
}
interface Collection {
  name?: string;
  description?: string;
  vars?: Record<string, unknown>;
  defaults?: { headers?: Record<string, unknown>; timeoutMs?: number };
  steps?: Step[];
}

function loadExisting(path: string): Collection {
  if (!existsSync(path)) return { steps: [] };
  const text = readFileSync(path, "utf8");
  if (extname(path) === ".json") return JSON.parse(text) as Collection;
  return parseYaml(text) as Collection;
}

function serialize(col: Collection, path: string): string {
  if (extname(path) === ".json") return JSON.stringify(col, null, 2);
  return stringifyYaml(col);
}

export function registerSaveTool(server: McpServer, session: Session): void {
  server.registerTool(
    "save_request",
    {
      title: "Save request to collection",
      description:
        "Persist last ad-hoc request (or explicit spec) as a new step in a collection file. " +
        "Params: path (required, .json/.yaml/.yml), id (optional, step id), type (optional, http|graphql|ws|sse), " +
        "request (optional, explicit spec; defaults to last call's request), assert, extract, tags, name (optional, set collection name). " +
        "Returns {saved, path, stepId, stepCount} or isError if no prior request and no explicit request.",
      inputSchema: {
        path: z.string().describe("Collection file path (.yaml/.yml/.json)."),
        id: z.string().optional().describe("Step id. Defaults to a generated one."),
        type: z.enum(["http", "graphql", "ws", "sse"]).optional().describe("Step type; defaults to the last request's type."),
        request: z.record(z.string(), z.any()).optional().describe("Explicit request spec. Defaults to the last call's request."),
        assert: z.array(z.record(z.string(), z.any())).optional(),
        extract: z.record(z.string(), z.string()).optional(),
        tags: z.array(z.string()).optional(),
        name: z.string().optional().describe("Set/replace the collection name."),
      },
    },
    async (args) => {
      const last = session.consumeLastRequest();
      const type = (args.type ?? last?.type ?? "http") as "http" | "graphql" | "ws" | "sse";
      const request = (args.request ?? last?.request ?? {}) as Record<string, unknown>;
      if (Object.keys(request).length === 0) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "save_request: no prior request recorded and no explicit request provided." }],
        };
      }

      const col = loadExisting(args.path);
      if (args.name) col.name = args.name;
      col.steps ??= [];
      const id = args.id ?? `step-${col.steps.length + 1}`;
      const { assert: _reqAssert, extract: _reqExtract, ...cleanRequest } = request;
      const step: Step = {
        id,
        type,
        request: cleanRequest,
        assert: args.assert ?? last?.assert,
        extract: args.extract ?? last?.extract,
        tags: args.tags,
      };
      col.steps.push(step);
      writeFileSync(args.path, serialize(col, args.path), "utf8");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ saved: true, path: args.path, stepId: id, stepCount: col.steps.length }, null, 2),
          },
        ],
      };
    },
  );
}
