import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-28 sm:pt-32 sm:pb-36">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="vv-hero-enter vv-hero-enter-delay-1 mb-6 border-primary/40 bg-primary/10 text-primary"
          >
            <span className="vv-pulse mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Agent-native API testing
          </Badge>

          <h1 className="vv-hero-enter vv-hero-enter-delay-2 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            API testing for the era of{" "}
            <span className="text-primary text-glow">AI coding agents</span>.
          </h1>

          <p className="vv-hero-enter vv-hero-enter-delay-3 mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            An MCP server that lets AI agents perform API testing autonomously - REST,
            GraphQL, WebSocket, SSE, and gRPC - without any GUI, manual clicking, or
            heavyweight desktop app. A lightweight, token-efficient alternative to
            Postman and Bruno.
          </p>

          <div className="vv-hero-enter vv-hero-enter-delay-4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/docs/install"
              className={`${buttonVariants({ size: "lg" })} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              <Terminal className="mr-2 h-4 w-4" />
              Quick start
            </Link>
            <Link
              href="/docs"
              className={`${buttonVariants({ variant: "outline", size: "lg" })} border-border/70 bg-transparent`}
            >
              Read the docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          <p className="vv-hero-enter vv-hero-enter-delay-4 mt-6 font-mono text-xs text-muted-foreground/70">
            npx -y @thupham/volley-mcp &nbsp;·&nbsp; cursor / windsurf / claude / vscode
          </p>
        </div>

        <CodePreview />
      </div>
    </section>
  );
}

function CodePreview() {
  return (
    <div
      data-reveal
      className="mx-auto mt-16 max-w-3xl"
      style={{ ["--vv-delay" as string]: "120ms" }}
    >
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-destructive/70" />
          <span className="h-3 w-3 rounded-full bg-chart-3/70" />
          <span className="h-3 w-3 rounded-full bg-primary/70" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            mcp · tools/call · http_request (assert + extract)
          </span>
        </div>
        <CodeBlock
          language="json"
          className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-foreground/90"
          code={`{
  "tool": "http_request",
  "input": {
    "method": "POST",
    "url": "https://api.example.com/login",
    "body": { "user": "a", "pass": "{{secret_pass}}" },
    "assert": [
      { "status": 200 },
      { "jsonpath": "$.token", "exists": true },
      { "timeMs": { "lt": 500 } }
    ],
    "extract": { "token": "$.token" }
  }
}

→ {
  "status": 200,
  "timeMs": 142,
  "assertions": { "passed": 3, "failed": 0 },
  "extracted": { "token": "***redacted***" },
  "responseHandle": "resp_a1b2"
}`}
        />
      </div>
    </div>
  );
}
