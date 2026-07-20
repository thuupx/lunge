"use client";

import { useMemo, useState } from "react";
import { tools, type Tool } from "@/lib/content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const categories: Tool["category"][] = [
  "Request",
  "Inspect",
  "Env",
  "Collection",
  "Import",
  "Policy",
];

export function ToolsExplorer() {
  const [active, setActive] = useState<string>("All");

  const filtered = useMemo(() => {
    if (active === "All") return tools;
    return tools.filter((t) => t.category === active);
  }, [active]);

  return (
    <div className="not-prose">
      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1">
          <TabsTrigger value="All" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            All ({tools.length})
          </TabsTrigger>
          {categories.map((cat) => {
            const count = tools.filter((t) => t.category === cat).length;
            return (
              <TabsTrigger
                key={cat}
                value={cat}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {cat} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {filtered.map((tool) => (
          <Card key={tool.name} className="bg-card/50 border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <code className="font-mono text-sm font-semibold text-primary">
                  {tool.name}
                </code>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {tool.category}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground break-words">
                {tool.signature}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
