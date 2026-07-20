import { pillars, protocols, comparison } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          {pillars.map((p) => (
            <Card
              key={p.title}
              className="bg-card/50 border-border/60 transition-colors hover:border-primary/40"
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
          {protocols.map((proto) => (
            <Card
              key={proto.name}
              className="relative bg-card/50 border-border/60 transition-colors hover:border-primary/40"
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

        <div className="mt-14 overflow-hidden rounded-xl border border-border/60">
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
        <CircleDot className="mx-auto mb-5 h-8 w-8 text-primary" />
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ship API tests from your editor.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Install Volley once and every agent you run gets a full API testing toolkit -
          no GUI, no copy-paste, no context bloat.
        </p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-4 py-3 font-mono text-xs">
          <span className="text-muted-foreground">$</span>
          <span className="text-foreground">pnpm add @volley/core</span>
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
    <div className="mx-auto max-w-2xl text-center">
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
