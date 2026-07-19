/**
 * Shapes an ExecResult into a token-efficient object for the model, honoring `verbosity`.
 * Full bodies live in the response store; only summaries/handles are surfaced by default.
 * Arrays (frames, events) are capped to prevent token blow-up.
 */
import type { AssertionReport, ExecResult } from "./native.js";
import type { Verbosity } from "./session.js";

const MAX_FRAMES_PREVIEW = 10;
const MAX_EVENTS_PREVIEW = 10;

function capArray(arr: unknown[] | undefined, max: number): unknown[] | undefined {
  if (!arr || arr.length <= max) return arr;
  return [...arr.slice(0, max), `…(+${arr.length - max} more, use inspect_response)`];
}

function assertionSummary(a: AssertionReport | undefined, verbosity: Verbosity) {
  if (!a) return undefined;
  const failed = a.results.filter((r) => !r.ok && !r.skipped);
  return {
    passed: a.passed,
    failed: a.failed,
    skipped: a.skipped,
    // Always surface failures; surface all results only when full.
    results: verbosity === "full" ? a.results : failed,
  };
}

export function formatHttp(
  result: ExecResult,
  verbosity: Verbosity,
  handle: string,
): Record<string, unknown> {
  if (result.error) return { ok: false, error: result.error };
  const out: Record<string, unknown> = {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    timeMs: result.timeMs,
    assertions: assertionSummary(result.assertions, verbosity),
    extracted: result.extracted && Object.keys(result.extracted).length ? result.extracted : undefined,
    bodyShape: result.bodyShape,
    bodyBytes: result.bodyBytes,
    responseHandle: handle,
    hint: "Use inspect_response with this handle + a jsonpath to read more of the body.",
  };
  if (result.graphqlErrors) out.graphqlErrors = result.graphqlErrors;
  if (verbosity === "headers" || verbosity === "full") out.headers = result.headers;
  if (verbosity === "full") out.body = result.bodyJson ?? result.bodyText ?? result.bodyPreview;
  return out;
}

export function formatWs(
  result: ExecResult,
  verbosity: Verbosity,
  handle: string,
): Record<string, unknown> {
  if (result.error) return { ok: false, connected: false, error: result.error };
  return {
    ok: result.ok,
    connected: result.connected,
    frameCount: result.frameCount,
    assertions: assertionSummary(result.assertions, verbosity),
    note: result.note,
    responseHandle: handle,
    frames: verbosity === "full" ? capArray(result.frames as unknown[] | undefined, MAX_FRAMES_PREVIEW) : result.framesPreview,
  };
}

export function formatSse(
  result: ExecResult,
  verbosity: Verbosity,
  handle: string,
): Record<string, unknown> {
  if (result.error) return { ok: false, connected: false, error: result.error };
  return {
    ok: result.ok,
    connected: result.connected,
    status: result.status,
    eventCount: result.eventCount,
    assertions: assertionSummary(result.assertions, verbosity),
    note: result.note,
    responseHandle: handle,
    events: verbosity === "full" ? capArray(result.events as unknown[] | undefined, MAX_EVENTS_PREVIEW) : result.eventsPreview,
  };
}
