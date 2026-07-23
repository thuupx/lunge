import Link from "next/link";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.72-4.04-1.59-4.04-1.59-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.23 1.84 1.23 1.07 1.8 2.81 1.28 3.5.98.11-.77.42-1.28.76-1.58-2.67-.3-5.47-1.31-5.47-5.84 0-1.29.47-2.34 1.23-3.17-.12-.3-.53-1.51.12-3.15 0 0 1-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.28-1.53 3.29-1.21 3.29-1.21.65 1.64.24 2.85.12 3.15.77.83 1.23 1.88 1.23 3.17 0 4.54-2.81 5.53-5.49 5.83.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .32.21.7.83.58A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/40">
            <Zap className="h-4 w-4 text-primary" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            lunge
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
            href="https://github.com/thuupx/lunge"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className={`${buttonVariants({ variant: "ghost", size: "sm" })} hidden sm:inline-flex`}
          >
            <GithubIcon className="h-4 w-4" />
            <span className="ml-1.5 hidden lg:inline">GitHub</span>
          </Link>
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
