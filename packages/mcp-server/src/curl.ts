/** Minimal `curl` command parser -> structured http_request spec. */

export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  bodyType?: "json" | "text";
  auth?: { type: "basic"; username: string; password?: string };
}

/** Tokenize a shell-ish command respecting single/double quotes and line continuations. */
function tokenize(input: string): string[] {
  const cleaned = input.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (/\s/.test(c)) {
      if (cur) tokens.push(cur), (cur = "");
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

export function parseCurl(command: string): ParsedCurl {
  const tokens = tokenize(command.trim());
  const out: ParsedCurl = { method: "", url: "", headers: {} };
  const dataParts: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i];
    if (t === "curl") continue;
    if (t === "-X" || t === "--request") out.method = next().toUpperCase();
    else if (t === "-H" || t === "--header") {
      const h = next();
      const idx = h.indexOf(":");
      if (idx > 0) out.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-ascii") {
      dataParts.push(next());
    } else if (t === "-u" || t === "--user") {
      const [username, password] = next().split(":");
      out.auth = { type: "basic", username, password };
    } else if (t === "--url") {
      out.url = next();
    } else if (t === "--compressed" || t === "-L" || t === "--location" || t === "-s" || t === "--silent" || t === "-k" || t === "--insecure") {
      /* flags without values, ignore */
    } else if (t.startsWith("-")) {
      // Unknown flag; skip a following value if it isn't another flag or the URL.
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-") && !/^https?:\/\//.test(tokens[i + 1])) i++;
    } else if (!out.url && /^https?:\/\//.test(t)) {
      out.url = t;
    } else if (!out.url) {
      out.url = t;
    }
  }

  if (dataParts.length) {
    const raw = dataParts.join("&");
    try {
      out.body = JSON.parse(raw);
      out.bodyType = "json";
    } catch {
      out.body = raw;
      out.bodyType = "text";
    }
    if (!out.method) out.method = "POST";
  }
  if (!out.method) out.method = "GET";
  return out;
}
