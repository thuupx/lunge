import Link from "next/link";
import { Zap } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/40">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="text-sm font-semibold">lunge</span>
          <span className="text-sm text-muted-foreground">
            - agent-native API testing
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/#features" className="hover:text-foreground">Features</Link>
          <Link href="/#testing" className="hover:text-foreground">Testing</Link>
          <Link href="/#protocols" className="hover:text-foreground">Protocols</Link>
          <Link href="/docs" className="hover:text-foreground">Docs</Link>
          <Link href="/docs/tools" className="hover:text-foreground">Tools</Link>
          <Link href="/docs/install" className="hover:text-foreground">Install</Link>
        </nav>

        <p className="text-xs text-muted-foreground/70">
          MIT licensed · Developed by Thu Pham
        </p>
      </div>
    </footer>
  );
}
