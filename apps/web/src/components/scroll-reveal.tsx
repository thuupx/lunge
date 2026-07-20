"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Lightweight scroll-reveal. Adds `vv-in` to any element with a `data-reveal`
 * attribute when it enters the viewport. Re-scans on every route change so
 * client-side navigations still animate (the root layout persists, so a plain
 * mount effect would only run once). Respects prefers-reduced-motion via the
 * CSS guard in globals.css.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.vv-in)")
        .forEach((n) => n.classList.add("vv-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("vv-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    // Defer one frame so the new page's DOM is committed before scanning.
    const id = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.vv-in)")
        .forEach((n) => io.observe(n));
    });

    return () => {
      cancelAnimationFrame(id);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
