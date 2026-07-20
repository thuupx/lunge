import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/hero";
import { Pillars, Protocols, Comparison, CTA } from "@/components/sections";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Pillars />
        <Protocols />
        <Comparison />
        <CTA />
      </main>
      <SiteFooter />
    </>
  );
}
