import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DocsSidebar } from "@/components/docs-sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-6">
        <DocsSidebar />
        <main className="min-w-0 flex-1 py-10 px-4">
          <article className="prose-lunge max-w-3xl">{children}</article>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
