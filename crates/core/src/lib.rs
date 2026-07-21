#![deny(clippy::all)]

//! lunge core engine.
//!
//! FFI contract: every tool crosses the boundary as JSON strings (request in, result out),
//! so the Rust types can evolve without breaking the TypeScript layer. See
//! `docs/architecture.md`.

use napi_derive::napi;

mod assert;
mod http;
mod optimizer;
mod sse;
mod template;
mod ws;

/// Returns the core engine version (compiled from Cargo.toml).
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Execute a REST/HTTP request. Input/output are JSON strings (see `docs/mcp-tools.md`).
#[napi]
pub async fn http_request(request_json: String) -> String {
    http::http_request(request_json).await
}

/// Execute a GraphQL query/mutation over HTTP.
#[napi]
pub async fn graphql_request(request_json: String) -> String {
    http::graphql_request(request_json).await
}

/// Introspect a GraphQL endpoint and return a summarized schema (root fields + type names).
#[napi]
pub async fn graphql_introspect(request_json: String) -> String {
    http::graphql_introspect(request_json).await
}

/// Open a bounded WebSocket session: connect, send, collect frames, return a summary.
#[napi]
pub async fn ws_session(request_json: String) -> String {
    ws::ws_session(request_json).await
}

/// Open a persistent WebSocket connection; returns a handle for ws_send/ws_recv/ws_close.
#[napi]
pub async fn ws_open(request_json: String) -> String {
    ws::ws_open(request_json).await
}

/// Send a message ({json} or {text}) on a persistent WebSocket connection.
#[napi]
pub fn ws_send(handle: String, message_json: String) -> String {
    ws::ws_send(handle, message_json)
}

/// Receive buffered frames from a persistent WebSocket connection (with an optional wait).
#[napi]
pub async fn ws_recv(request_json: String) -> String {
    ws::ws_recv(request_json).await
}

/// Close a persistent WebSocket connection.
#[napi]
pub fn ws_close(handle: String) -> String {
    ws::ws_close(handle)
}

/// Subscribe to an SSE endpoint and collect events until a stop condition.
#[napi]
pub async fn sse_session(request_json: String) -> String {
    sse::sse_session(request_json).await
}

/// Run a JSONPath (RFC 9535) selector against a JSON document. Used by
/// `inspect_response` to let the agent pull only the slice it needs from a stored body.
/// Supports filters: `$.items[?@.id==1]`, slices: `$.items[0:5]`, wildcards: `$..field`.
/// String literals in filters must use double quotes: `[?@.name=="x"]`.
#[napi]
pub fn json_query(document_json: String, path: String) -> String {
    let doc: serde_json::Value = match serde_json::from_str(&document_json) {
        Ok(v) => v,
        Err(e) => return serde_json::json!({ "error": format!("invalid json: {e}") }).to_string(),
    };
    match assert::select_with_error(Some(&doc), &path) {
        Ok(Some(v)) => serde_json::json!({ "found": true, "value": v }).to_string(),
        Ok(None) => serde_json::json!({ "found": false, "value": serde_json::Value::Null }).to_string(),
        Err(e) => serde_json::json!({ "found": false, "error": e, "value": serde_json::Value::Null }).to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_non_empty() {
        assert!(!version().is_empty());
    }

    #[test]
    fn json_query_selects() {
        let doc = r#"{"items":[{"id":1},{"id":2}]}"#;
        let out = json_query(doc.into(), "$.items[1].id".into());
        assert!(out.contains("\"value\":2"));
    }

    #[test]
    fn json_query_filter_works() {
        let doc = r#"{"items":[{"id":1,"name":"a"},{"id":2,"name":"b"}]}"#;
        let out = json_query(doc.into(), "$.items[?@.id==2].name".into());
        assert!(out.contains("\"value\":\"b\""), "got: {out}");
    }

    #[test]
    fn json_query_parse_error_surfaced() {
        let doc = r#"{"a":1}"#;
        let out = json_query(doc.into(), "$$.bad[".into());
        assert!(out.contains("\"error\""), "got: {out}");
    }
}
