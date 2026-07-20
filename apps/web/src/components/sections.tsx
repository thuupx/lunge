import { pillars, protocols, comparison } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/code-block";
import { Check, CircleDot } from "lucide-react";

export function Pillars() {
  return (
    <section id="features" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Design pillars"
          title="Built for agents, not clickers"
          subtitle="Four principles that shape every tool, every response, and every byte on the wire."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <Card
              key={p.title}
              data-reveal
              style={{ ["--vv-delay" as string]: `${i * 80}ms` }}
              className="vv-lift bg-card/50 border-border/60 hover:border-primary/40"
            >
              <CardHeader>
                <CardTitle className="text-base">{p.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DeclarativeTesting() {
  return (
    <section id="testing" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Declarative testing"
          title="Agent emits JSON, not JavaScript"
          subtitle="Postman agent mode makes you write pm.test scripts. Volley assertions are structured data the model can emit directly — no code generation, no JS to parse, no verbose output."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Card
            data-reveal
            className="bg-card/50 border-border/60"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Postman agent mode</CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Imperative JS
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CodeBlock
                language="javascript"
                className="overflow-x-auto rounded-md border border-border/60 bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
                code={`pm.test("login ok", () => {
  pm.expect(res.code).to.equal(200);
  pm.expect(res.json().token)
    .to.be.a("string");
  pm.expect(res.responseTime)
    .to.be.below(500);
});
pm.variables.set("token",
  res.json().token);`}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Agent must generate valid JS, the runner evaluates it, and output is
                human-readable prose — expensive on the context window.
              </p>
            </CardContent>
          </Card>

          <Card
            data-reveal
            style={{ ["--vv-delay" as string]: "80ms" }}
            className="vv-lift bg-card/50 border-primary/40 hover:border-primary/60"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-primary">Volley assert</CardTitle>
                <Badge className="bg-primary/15 text-primary border-primary/40 text-[10px] uppercase tracking-wider">
                  Declarative JSON
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CodeBlock
                language="json"
                className="overflow-x-auto rounded-md border border-border/60 bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-foreground/90"
                code={`"assert": [
  { "status": 200 },
  { "jsonpath": "$.token", "exists": true },
  { "timeMs": { "lt": 500 } }
],
"extract": { "token": "$.token" }`}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Agent emits structured JSON. The Rust core evaluates it and returns a
                compact pass/fail summary. Same assertion power, a fraction of the tokens.
              </p>
            </CardContent>
          </Card>
        </div>

        <div
          data-reveal
          className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground"
          style={{ ["--vv-delay" as string]: "160ms" }}
        >
          <p>
            Matchers:{" "}
            <code className="font-mono text-xs text-foreground">equals</code>,{" "}
            <code className="font-mono text-xs text-foreground">notEquals</code>,{" "}
            <code className="font-mono text-xs text-foreground">in</code>,{" "}
            <code className="font-mono text-xs text-foreground">contains</code>,{" "}
            <code className="font-mono text-xs text-foreground">matches</code> (regex),{" "}
            <code className="font-mono text-xs text-foreground">exists</code>,{" "}
            <code className="font-mono text-xs text-foreground">gt/gte/lt/lte</code>,{" "}
            <code className="font-mono text-xs text-foreground">length</code>, plus{" "}
            <code className="font-mono text-xs text-foreground">not:</code> negation and{" "}
            <code className="font-mono text-xs text-foreground">schema:</code> JSON Schema
            validation.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Protocols() {
  return (
    <section id="protocols" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Protocols"
          title="One server, every protocol"
          subtitle="Stop juggling Postman, a WS client, an SSE inspector, and a GraphQL playground. Volley covers them all behind a single MCP tool surface."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {protocols.map((proto, i) => (
            <Card
              key={proto.name}
              data-reveal
              style={{ ["--vv-delay" as string]: `${i * 70}ms` }}
              className="vv-lift relative bg-card/50 border-border/60 hover:border-primary/40"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{proto.name}</CardTitle>
                  <Badge
                    variant={proto.status === "shipped" ? "default" : "outline"}
                    className={
                      proto.status === "shipped"
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "text-muted-foreground"
                    }
                  >
                    {proto.status === "shipped" ? "Shipped" : "Planned"}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-primary/80">{proto.tagline}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{proto.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Comparison() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Why this exists"
          title="Postman without the Postman"
          subtitle="The tools agents already use are GUI-first and verbose. Volley is the inverse: a small, open, token-thin tool surface designed for the model context."
        />

        <div
          data-reveal
          className="mt-14 overflow-hidden rounded-xl border border-border/60"
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Pain with Postman / Bruno</th>
                <th className="px-5 py-3 font-medium text-primary">Volley approach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {comparison.map((row) => (
                <tr key={row.pain} className="bg-card/30 transition-colors hover:bg-card/60">
                  <td className="px-5 py-4 text-muted-foreground">{row.pain}</td>
                  <td className="px-5 py-4">
                    <span className="flex items-start gap-2 text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{row.approach}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <CircleDot
          data-reveal
          className="vv-hero-enter mx-auto mb-5 h-8 w-8 text-primary"
        />
        <h2
          data-reveal
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ ["--vv-delay" as string]: "80ms" }}
        >
          Ship API tests from your editor.
        </h2>
        <p
          data-reveal
          className="mx-auto mt-4 max-w-xl text-muted-foreground"
          style={{ ["--vv-delay" as string]: "160ms" }}
        >
          Install Volley once and every agent you run gets a full API testing toolkit -
          no GUI, no copy-paste, no context bloat.
        </p>
        <div
          data-reveal
          className="mt-8 inline-flex flex-col gap-1 rounded-lg border border-border/60 bg-card/60 px-4 py-3 font-mono text-xs text-left"
          style={{ ["--vv-delay" as string]: "240ms" }}
        >
          <span className="text-muted-foreground"># mcp.json</span>
          <span className="text-foreground">
            <span className="text-primary">&quot;volley&quot;</span>: {"{"}
            <span className="text-muted-foreground"> &quot;command&quot;: &quot;node&quot;, </span>
          </span>
          <span className="pl-4 text-foreground">
            <span className="text-muted-foreground">&quot;args&quot;: [</span>
            <span className="text-primary">&quot;.../mcp-server/dist/index.js&quot;</span>
            <span className="text-muted-foreground">] {"}"} </span>
          </span>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div data-reveal className="mx-auto max-w-2xl text-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary/80">
        {eyebrow}
      </p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-muted-foreground">{subtitle}</p>
    </div>
  );
}
