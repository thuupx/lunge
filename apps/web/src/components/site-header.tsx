import Link from "next/link";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/40">
            <Zap className="h-4 w-4 text-primary" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            volley
          </span>
          <Badge variant="secondary" className="ml-1 text-[10px] uppercase tracking-wider">
            MCP
          </Badge>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="/#features" className="transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="/#testing" className="transition-colors hover:text-foreground">
            Testing
          </Link>
          <Link href="/#protocols" className="transition-colors hover:text-foreground">
            Protocols
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <Link href="/docs/tools" className="transition-colors hover:text-foreground">
            Tools
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className={`${buttonVariants({ variant: "ghost", size: "sm" })} hidden sm:inline-flex`}
          >
            Get started
          </Link>
          <Link
            href="/docs/install"
            className={`${buttonVariants({ size: "sm" })} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            Install
          </Link>
        </div>
      </div>
    </header>
  );
}
