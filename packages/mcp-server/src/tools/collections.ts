import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeFileSync } from "node:fs";
import { listCollectionFiles, loadCollection, runCollection } from "../collections.js";
import { toJUnitXml } from "../junit.js";
import type { Session } from "../session.js";

export function registerCollectionTools(server: McpServer, session: Session): void {
  server.registerTool(
    "list_collections",
    {
      title: "List collections",
      description: "Find collection files (.yaml/.yml/.json) under a directory.",
      inputSchema: {
        dir: z.string().optional().describe("Directory to scan. Defaults to the current working directory."),
      },
    },
    async ({ dir }) => {
      const files = listCollectionFiles(dir ?? process.cwd());
      const items = files.map((path) => {
        try {
          const col = loadCollection(path);
          return { path, name: col.name, steps: col.steps?.length ?? 0 };
        } catch {
          return { path, error: "failed to parse" };
        }
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }] };
    },
  );

  server.registerTool(
    "run_collection",
    {
      title: "Run a collection",
      description: "Run declarative collection file. Threads extracted vars between steps. Optional JUnit XML export.",
      inputSchema: {
        path: z.string().describe("Path to the collection file."),
        env: z.string().optional().describe("Environment to resolve variables from."),
        only: z.array(z.string()).optional().describe("Only run steps with these ids."),
        tags: z.array(z.string()).optional().describe("Only run steps having any of these tags."),
        junitPath: z.string().optional().describe("Write a JUnit XML report to this path."),
      },
    },
    async ({ path, env, only, tags, junitPath }) => {
      try {
        const report = await runCollection(session, path, { env, only, tags });
        if (junitPath) writeFileSync(junitPath, toJUnitXml(report), "utf8");
        return { content: [{ type: "text" as const, text: JSON.stringify(session.redact(report), null, 2) }] };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `run_collection failed: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    },
  );
}
