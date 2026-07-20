import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/hero";
import { Pillars, DeclarativeTesting, Protocols, Comparison, CTA } from "@/components/sections";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Pillars />
        <DeclarativeTesting />
        <Protocols />
        <Comparison />
        <CTA />
      </main>
      <SiteFooter />
    </>
  );
}
