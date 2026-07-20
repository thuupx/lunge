"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  href: string;
  label: string;
  badge?: string;
};

const nav: { section: string; items: NavItem[] }[] = [
  {
    section: "Getting started",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/install", label: "Install" },
      { href: "/docs/quickstart", label: "Quick start" },
    ],
  },
  {
    section: "Reference",
    items: [
      { href: "/docs/tools", label: "MCP tools" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/collections", label: "Collections" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border/60 md:block">
      <nav className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-6">
        {nav.map((group) => (
          <div key={group.section} className="mb-6">
            <p className="mb-2 px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.badge ? (
                        <Badge variant="outline" className="text-[10px]">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
