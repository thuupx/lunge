import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Docs - Lunge",
};

export default function DocsIndexPage() {
  return (
    <>
      <h1>Lunge documentation</h1>
      <p className="lead">
        An MCP (Model Context Protocol) server that lets AI agents perform API testing
        autonomously - REST, GraphQL, WebSocket, SSE, and (later) gRPC - without any GUI,
        manual clicking, or heavyweight desktop app.
      </p>

      <p>
        Lunge is a lightweight, token-efficient alternative to Postman and Bruno for the
        era of AI coding agents. The agent calls tools directly over stdio; there are no
        humans in the loop and no bloated feature surface to pay for. A Rust core handles
        execution, protocols, and summarization, exposed to a thin TypeScript MCP layer via
        napi-rs.
      </p>

      <h2>What you&apos;ll find here</h2>
      <ul>
        <li>
          <Link href="/docs/install">Install</Link> - set up the Lunge MCP server in
          Cursor, Windsurf, or Claude Desktop.
        </li>
        <li>
          <Link href="/docs/quickstart">Quick start</Link> - fire your first request,
          chain a token, and inspect a response.
        </li>
        <li>
          <Link href="/docs/tools">MCP tools</Link> - the full tool surface: names,
          inputs, outputs, and examples.
        </li>
        <li>
          <Link href="/docs/architecture">Architecture</Link> - the Rust/TS split, module
          layout, streaming strategy, and the FFI boundary.
        </li>
        <li>
          <Link href="/docs/collections">Collections</Link> - the declarative YAML/JSON
          test/collection format.
        </li>
      </ul>

      <h2>Design pillars</h2>
      <ol>
        <li>
          <strong>Agent-native</strong> - designed for LLM tool calls, not human UIs.
        </li>
        <li>
          <strong>Token-efficient</strong> - every response is filtered, truncated, and
          summarized. Full payloads are spilled to disk and referenced by handle.
        </li>
        <li>
          <strong>Fast &amp; portable</strong> - a Rust core exposed to a thin TypeScript
          MCP layer via napi-rs.
        </li>
        <li>
          <strong>Both ad-hoc and reusable</strong> - agents can fire one-off requests or
          create, save, and re-run declarative collections.
        </li>
      </ol>

      <div className="not-prose mt-10 rounded-xl border border-border/60 bg-card/40 p-6">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-primary/80">
          Next
        </p>
        <Link
          href="/docs/install"
          className="inline-flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary"
        >
          Install Lunge
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
