/**
 * Serialize a RunReport (from run_collection) into JUnit XML for CI consumption.
 */
import type { RunReport } from "./collections.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toJUnitXml(report: RunReport): string {
  const cases = report.steps
    .map((s) => {
      const name = esc(s.id);
      const time = ""; // timing not tracked per step yet
      if (s.skipped) {
        return `    <testcase name="${name}" time="${time}"><skipped/></testcase>`;
      }
      if (s.ok) {
        return `    <testcase name="${name}" time="${time}"/>`;
      }
      const failure = s.failures?.map((f) => esc(f)).join("; ") ?? (s.error ? esc(s.error) : "failed");
      return `    <testcase name="${name}" time="${time}"><failure message="${failure}">${failure}</failure></testcase>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${esc(report.name)}" tests="${report.steps.length}" failures="${report.failed}" skipped="${report.skipped}">
${cases}
</testsuite>
`;
}
