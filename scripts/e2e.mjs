// End-to-end verification: starts a local test server, spawns the MCP server over stdio,
// and drives every tool (REST, GraphQL, WS, SSE, env, inspect, collection, curl import,
// graphql_introspect, persistent WS, save_request, policy, importers, JUnit export).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestServer } from "./testserver.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(root, "..", "packages", "mcp-server", "dist", "index.js");
const collection = path.join(root, "..", "examples", "smoke.collection.yaml");

const srv = await startTestServer();
const child = spawn(process.execPath, [serverEntry], { stdio: ["pipe", "pipe", "inherit"] });

let buf = "";
const responses = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) {
      const msg = JSON.parse(line);
      if (msg.id) responses.set(msg.id, msg);
    }
  }
});

let idc = 0;
const rpc = (method, params) => {
  const id = ++idc;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (responses.has(id)) {
        clearInterval(t);
        resolve(responses.get(id));
      }
    }, 15);
    setTimeout(() => { clearInterval(t); reject(new Error(`timeout: ${method}`)); }, 15000);
  });
};
const call = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
  return JSON.parse(r.result.content[0].text);
};

const results = [];
const check = (label, cond, detail) => {
  results.push({ label, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -> " + JSON.stringify(detail)}`);
};

try {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "e2e", version: "0.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const tools = (await rpc("tools/list", {})).result.tools.map((t) => t.name);
  check("tools/list exposes all tools", ["http_request", "graphql_request", "graphql_introspect", "ws_session", "ws_open", "ws_send", "ws_recv", "ws_close", "sse_session", "inspect_response", "set_env", "list_envs", "run_collection", "list_collections", "import_curl", "import_openapi", "import_har", "save_request", "set_policy"].every((t) => tools.includes(t)), tools);

  // env with a secret
  await call("set_env", { name: "dev", vars: { baseUrl: srv.httpUrl, secretPass: { value: "s3cr3t", secret: true } } });

  // REST + assertions + jsonpath
  const j = await call("http_request", {
    url: `${srv.httpUrl}/json`,
    assert: [{ status: 200 }, { jsonpath: "$.nested.a.b", equals: 42 }, { jsonpath: "$.items.length", gte: 3 }],
    verbosity: "summary",
  });
  check("REST GET + assertions pass", j.ok && j.assertions.failed === 0, j);

  // inspect_response drill-down
  const insp = await call("inspect_response", { handle: j.responseHandle, jsonpath: "$.items[0:2]" });
  check("inspect_response returns slice", JSON.stringify(insp.value) === JSON.stringify([1, 2]), insp);

  // inspect_response with JSONPath filter (RFC 9535)
  const inspFilter = await call("inspect_response", { handle: j.responseHandle, jsonpath: "$.items[?@>2]" });
  check("inspect_response JSONPath filter works", inspFilter.found && JSON.stringify(inspFilter.value) === JSON.stringify([3, 4, 5]), inspFilter);

  // inspect_response maxItems truncation
  const inspCap = await call("inspect_response", { handle: j.responseHandle, jsonpath: "$.items", maxItems: 2 });
  check("inspect_response maxItems truncates", inspCap.truncated && inspCap.value.length === 3 && /more/.test(inspCap.value[2]), inspCap);

  // inspect_response JSONPath parse error surfaced
  const inspErrRaw = await rpc("tools/call", { name: "inspect_response", arguments: { handle: j.responseHandle, jsonpath: "$$bad[" } });
  check("inspect_response surfaces jsonpath parse error", inspErrRaw.result?.isError === true || /jsonpath error/.test(inspErrRaw.result?.content?.[0]?.text || ""), inspErrRaw);

  // chaining: login -> extract token -> use it
  const login = await call("http_request", {
    method: "POST", url: `${srv.httpUrl}/login`, body: { user: "admin" },
    assert: [{ status: 200 }], extract: { token: "$.token" },
    verbosity: "full", // should be auto-downgraded to summary since extract is set
  });
  check("login extracts token", login.extracted && login.extracted.token === "tok_admin", login);
  check("verbosity auto-downgraded with extract", login.body === undefined, login);

  const me = await call("http_request", {
    url: `${srv.httpUrl}/me`, auth: { type: "bearer", token: "{{token}}" },
    assert: [{ status: 200 }, { jsonpath: "$.username", equals: "admin" }],
  });
  check("protected endpoint via chained token", me.ok && me.assertions.failed === 0, me);

  // GraphQL
  const gql = await call("graphql_request", {
    url: `${srv.httpUrl}/graphql`,
    query: "query { user(id: 42) { id name } }",
    assert: [{ status: 200 }, { jsonpath: "$.data.user.name", equals: "admin" }],
  });
  check("GraphQL query + assertion", gql.ok && !gql.graphqlErrors, gql);

  // SSE
  const sse = await call("sse_session", {
    url: `${srv.httpUrl}/events`,
    collect: { maxEvents: 5, maxDurationMs: 3000 },
    assert: [{ anyEvent: { jsonpath: "$.type", equals: "tick" } }, { eventCount: { gte: 3 } }],
  });
  check("SSE collects events + assertions", sse.ok && sse.eventCount >= 3, sse);

  // WebSocket
  const ws = await call("ws_session", {
    url: srv.wsUrl,
    send: [{ json: { type: "subscribe" } }],
    collect: { maxMessages: 10, maxDurationMs: 3000, until: { jsonpath: "$.type", equals: "done" } },
    assert: [{ anyFrame: { jsonpath: "$.type", equals: "ack" } }],
  });
  check("WebSocket bounded session + assertions", ws.ok && ws.frameCount >= 1, ws);

  // GraphQL introspection (enriched: field sigs + input types)
  const intro = await call("graphql_introspect", { url: `${srv.httpUrl}/graphql` });
  check("graphql_introspect returns enriched schema", intro.ok && intro.schema && Array.isArray(intro.schema.queries) && Array.isArray(intro.schema.inputTypes), intro);
  const loginMutation = (intro.schema.mutations || []).find((m) => m.sig && m.sig.startsWith("login"));
  check("graphql_introspect includes login mutation signature", loginMutation && loginMutation.sig.includes("login"), loginMutation);

  // Persistent WebSocket: open -> send -> recv -> close
  const wsOpen = await call("ws_open", { url: srv.wsUrl });
  check("ws_open returns handle", wsOpen.ok && wsOpen.handle && wsOpen.connected, wsOpen);
  const wsSend = await call("ws_send", { handle: wsOpen.handle, json: { type: "ping" } });
  check("ws_send succeeds", wsSend.ok, wsSend);
  const wsRecv = await call("ws_recv", { handle: wsOpen.handle, maxMessages: 10, maxDurationMs: 2000 });
  check("ws_recv drains frames", wsRecv.ok && wsRecv.count >= 1, wsRecv);
  const wsClose = await call("ws_close", { handle: wsOpen.handle });
  check("ws_close succeeds", wsClose.ok && wsClose.closed, wsClose);

  // save_request: persist the last http_request into a new collection, then run it
  const tmp = mkdtempSync(join(tmpdir(), "lunge-e2e-"));
  const savedPath = join(tmp, "saved.yaml");
  // Re-issue a request so there's a "last" to save.
  await call("http_request", { url: `${srv.httpUrl}/json`, assert: [{ status: 200 }] });
  const saved = await call("save_request", { path: savedPath, id: "smoke-json" });
  check("save_request writes collection file", saved.saved && saved.stepCount === 1, saved);
  const savedRun = await call("run_collection", { path: savedPath });
  check("saved collection runs", savedRun.ok && savedRun.passed === 1, savedRun);

  // set_policy: deny a host, then allow + dry-run
  const blocked = await call("http_request", { url: "http://evil.example.com/json" });
  // No policy yet -> should attempt (and fail to connect), but not be blocked.
  await call("set_policy", { deny: ["evil.example.com"] });
  const blocked2 = await call("http_request", { url: "http://evil.example.com/json" });
  check("set_policy deny blocks request", !blocked2.ok && /denied by policy/.test(blocked2.error), blocked2);
  await call("set_policy", { allow: ["127.0.0.1"], dryRun: true });
  const dry = await call("http_request", { url: `${srv.httpUrl}/json` });
  check("set_policy dry-run returns synthetic result", dry.ok && dry.statusText === "DRY RUN", dry);
  // Reset policy for subsequent checks.
  await call("set_policy", { allow: [], deny: [], dryRun: false });
  const blockedAllow = await call("http_request", { url: "http://other.example.com/json" });
  check("set_policy empty allow permits non-denied host", !blockedAllow.ok && !/denied by policy|not in the allow-list/.test(blockedAllow.error || ""), blockedAllow);

  // import_openapi: write a tiny OpenAPI doc, import it, run the generated collection
  const openApiPath = join(tmp, "pet.json");
  writeFileSync(
    openApiPath,
    JSON.stringify({
      openapi: "3.0.0",
      info: { title: "pet", version: "1" },
      servers: [{ url: srv.httpUrl }],
      paths: {
        "/json": { get: { operationId: "getJson", tags: ["read"], responses: { "200": { description: "ok" } } } },
        "/login": {
          post: {
            operationId: "login",
            requestBody: { content: { "application/json": { schema: { type: "object", properties: { user: { type: "string" } } } } } },
            responses: { "200": { description: "ok" } },
          },
        },
      },
    }),
  );
  const openApiColPath = join(tmp, "pet.collection.yaml");
  const imp = await call("import_openapi", { path: openApiPath, out: openApiColPath, includeTags: ["read"] });
  check("import_openapi creates collection", imp.imported && imp.steps === 1, imp);
  const impRun = await call("run_collection", { path: openApiColPath });
  check("imported OpenAPI collection runs", impRun.ok && impRun.passed === 1, impRun);

  // import_har: write a tiny HAR doc, import it
  const harPath = join(tmp, "capture.har");
  writeFileSync(
    harPath,
    JSON.stringify({
      log: {
        entries: [
          {
            request: { method: "GET", url: `${srv.httpUrl}/json`, headers: [{ name: "X-Test", value: "1" }] },
            response: { status: 200 },
          },
          {
            request: { method: "POST", url: `${srv.httpUrl}/login`, postData: { mimeType: "application/json", text: '{"user":"har"}' } },
            response: { status: 200 },
          },
          {
            request: { method: "GET", url: `${srv.httpUrl}/missing`, headers: [] },
            response: { status: 404 },
          },
        ],
      },
    }),
  );
  const harColPath = join(tmp, "har.collection.yaml");
  const impHar = await call("import_har", { path: harPath, out: harColPath, only2xx: true });
  check("import_har creates filtered collection", impHar.imported && impHar.steps === 2, impHar);
  const harRun = await call("run_collection", { path: harColPath });
  check("imported HAR collection runs", harRun.ok && harRun.passed === 2, harRun);

  // JUnit XML export from run_collection
  const junitPath = join(tmp, "junit.xml");
  const junitRun = await call("run_collection", { path: collection, env: "dev", junitPath });
  const junitXml = readFileSync(junitPath, "utf8");
  check("run_collection writes JUnit XML", junitRun.ok && junitXml.includes("<testsuite") && /Smoke/i.test(junitXml), junitXml.slice(0, 200));

  // Collection run (threads token between steps)
  const rep = await call("run_collection", { path: collection, env: "dev" });
  check("run_collection all steps pass", rep.ok && rep.failed === 0 && rep.passed === 2, rep);

  // curl import (parse + execute)
  const curl = await call("import_curl", { curl: `curl -X POST ${srv.httpUrl}/login -H 'Content-Type: application/json' -d '{"user":"bob"}'`, execute: true });
  check("import_curl parses + executes", curl.parsed.method === "POST" && curl.result.ok, curl);

  // secret redaction
  const listEnv = await call("list_envs", { name: "dev" });
  check("secret masked in env listing", listEnv.vars.secretPass === "***", listEnv);
} catch (e) {
  console.error("ERROR:", e.message);
  results.push({ label: "harness", pass: false });
} finally {
  child.kill();
  await srv.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
