import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeFileSync } from "node:fs";
import { extname } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { loadOpenApi, openApiToCollection, loadHar, harToCollection } from "../importers.js";
import type { Collection } from "../collections.js";

function serialize(col: Collection, path: string): string {
  if (extname(path) === ".json") return JSON.stringify(col, null, 2);
  return stringifyYaml(col);
}

export function registerImporterTools(server: McpServer): void {
  server.registerTool(
    "import_openapi",
    {
      title: "Import OpenAPI to collection",
      description:
        "Parse OpenAPI/Swagger (JSON/YAML) → Lunge collection. One step per operation with 2xx assertion. " +
        "Params: path (required, file path), out (optional, write collection to .json/.yaml/.yml), " +
        "includeTags (optional, only ops with these tags), maxSteps (optional, cap step count, default 200). " +
        "Returns {ok, imported, name, steps, writtenTo}.",
      inputSchema: {
        path: z.string().describe("Path to the OpenAPI/Swagger file."),
        out: z.string().optional().describe("Write the resulting collection to this path (.yaml/.yml/.json)."),
        includeTags: z.array(z.string()).optional().describe("Only import operations with any of these tags."),
        maxSteps: z.number().int().positive().optional().describe("Cap the number of generated steps (default 200)."),
      },
    },
    async (args) => {
      try {
        const doc = loadOpenApi(args.path);
        const col = openApiToCollection(doc, { includeTags: args.includeTags, maxSteps: args.maxSteps });
        if (args.out) writeFileSync(args.out, serialize(col, args.out), "utf8");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { ok: true, imported: true, name: col.name, steps: col.steps?.length ?? 0, writtenTo: args.out ?? null },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `import_openapi failed: ${e instanceof Error ? e.message : String(e)}` },
          ],
        };
      }
    },
  );

  server.registerTool(
    "import_har",
    {
      title: "Import HAR to collection",
      description:
        "Parse HAR file → Lunge collection. Splits query/headers/body. Optional 2xx filter. " +
        "Params: path (required, .json HAR file), out (optional, write to .json/.yaml/.yml), " +
        "only2xx (optional, only keep 2xx responses), maxSteps (optional, cap step count, default 200). " +
        "Returns {ok, imported, name, steps, writtenTo}.",
      inputSchema: {
        path: z.string().describe("Path to the HAR file (.json)."),
        out: z.string().optional().describe("Write the resulting collection to this path (.yaml/.yml/.json)."),
        maxSteps: z.number().int().positive().optional().describe("Cap the number of generated steps (default 200)."),
        only2xx: z.boolean().optional().describe("Only include requests that returned a 2xx response."),
      },
    },
    async (args) => {
      try {
        const har = loadHar(args.path);
        const col = harToCollection(har, {
          maxSteps: args.maxSteps,
          filter: args.only2xx ? (e) => (e.response?.status ?? 0) >= 200 && (e.response?.status ?? 0) < 300 : undefined,
        });
        if (args.out) writeFileSync(args.out, serialize(col, args.out), "utf8");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { ok: true, imported: true, name: col.name, steps: col.steps?.length ?? 0, writtenTo: args.out ?? null },
                null,
                2,
              ),
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: `import_har failed: ${e instanceof Error ? e.message : String(e)}` },
          ],
        };
      }
    },
  );
}
