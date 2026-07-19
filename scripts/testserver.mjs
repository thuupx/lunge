// Local test server exercising REST, GraphQL, SSE and WebSocket for e2e verification.
import http from "node:http";
import { WebSocketServer } from "ws";

export function startTestServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    const readBody = () =>
      new Promise((resolve) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => resolve(b));
      });

    if (url.pathname === "/json") {
      return send(200, { message: "hello", items: [1, 2, 3, 4, 5], nested: { a: { b: 42 } } });
    }
    if (url.pathname === "/login" && req.method === "POST") {
      return readBody().then((b) => {
        const user = (JSON.parse(b || "{}").user) || "anon";
        send(200, { token: `tok_${user}`, expiresIn: 3600 });
      });
    }
    if (url.pathname === "/me") {
      const auth = req.headers.authorization || "";
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!token.startsWith("tok_")) return send(401, { error: "unauthorized" });
      return send(200, { username: token.slice(4) });
    }
    if (url.pathname === "/graphql" && req.method === "POST") {
      return readBody().then((b) => {
        const { query } = JSON.parse(b || "{}");
        if (query && query.includes("__schema")) {
          return send(200, {
            data: {
              __schema: {
                queryType: { name: "Query" },
                mutationType: { name: "Mutation" },
                subscriptionType: null,
                types: [
                  { name: "Query", kind: "OBJECT", fields: [{ name: "user", type: { name: "User" } }] },
                  { name: "User", kind: "OBJECT", fields: [{ name: "id", type: { name: "ID" } }, { name: "name", type: { name: "String" } }] },
                  { name: "Mutation", kind: "OBJECT", fields: [{ name: "login", type: { name: "String" } }] },
                ],
              },
            },
          });
        }
        if (query && query.includes("user")) return send(200, { data: { user: { id: "42", name: "admin" } } });
        send(200, { errors: [{ message: "unknown query" }] });
      });
    }
    if (url.pathname === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      let n = 0;
      const iv = setInterval(() => {
        res.write(`event: tick\ndata: ${JSON.stringify({ type: "tick", n: n++ })}\n\n`);
        if (n >= 3) {
          clearInterval(iv);
          res.write(`event: done\ndata: {}\n\n`);
          res.end();
        }
      }, 15);
      return;
    }
    send(404, { error: "not found" });
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.on("message", () => {
      ws.send(JSON.stringify({ type: "ack" }));
      ws.send(JSON.stringify({ type: "data", value: 1 }));
      setTimeout(() => ws.send(JSON.stringify({ type: "done" })), 10);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        httpUrl: `http://127.0.0.1:${port}`,
        wsUrl: `ws://127.0.0.1:${port}/ws`,
        close: () => new Promise((r) => { wss.close(); server.close(r); }),
      });
    });
  });
}
