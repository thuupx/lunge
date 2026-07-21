//! REST/HTTP and GraphQL execution via reqwest, plus assertions, extraction and
//! token-optimized summaries. Input/output cross the FFI boundary as JSON.

use crate::{assert, optimizer, template};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::time::Instant;

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct AuthSpec {
    r#type: String,
    token: Option<String>,
    username: Option<String>,
    password: Option<String>,
    key: Option<String>,
    value: Option<String>,
    r#in: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct HttpSpec {
    method: Option<String>,
    url: String,
    headers: Map<String, Value>,
    query: Map<String, Value>,
    body: Option<Value>,
    body_type: Option<String>,
    auth: Option<AuthSpec>,
    timeout_ms: Option<u64>,
    follow_redirects: Option<bool>,
}

fn v2s(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn error_result(msg: String) -> String {
    json!({ "ok": false, "error": msg }).to_string()
}

/// Resolve `{{vars}}` in the spec and pull out the vars map.
fn resolve_spec(request_json: &str) -> Result<(Value, Map<String, Value>), String> {
    let raw: Value = serde_json::from_str(request_json).map_err(|e| format!("invalid request json: {e}"))?;
    let vars = raw
        .get("vars")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let resolved = template::resolve(&raw, &vars);
    Ok((resolved, vars))
}

async fn perform(spec: HttpSpec, resolved: &Value) -> Result<String, String> {
    let mut builder = reqwest::Client::builder().user_agent("lunge/0.0");
    if spec.follow_redirects == Some(false) {
        builder = builder.redirect(reqwest::redirect::Policy::none());
    }
    if let Some(ms) = spec.timeout_ms {
        builder = builder.timeout(std::time::Duration::from_millis(ms));
    }
    let client = builder.build().map_err(|e| format!("client build failed: {e}"))?;

    let method = reqwest::Method::from_bytes(
        spec.method.as_deref().unwrap_or("GET").to_uppercase().as_bytes(),
    )
    .map_err(|e| format!("invalid method: {e}"))?;

    let mut req = client.request(method, &spec.url);

    // Query params.
    let query: Vec<(String, String)> = spec.query.iter().map(|(k, v)| (k.clone(), v2s(v))).collect();
    if !query.is_empty() {
        req = req.query(&query);
    }

    // Headers.
    for (k, v) in &spec.headers {
        req = req.header(k, v2s(v));
    }

    // Auth.
    if let Some(auth) = &spec.auth {
        match auth.r#type.as_str() {
            "bearer" => {
                if let Some(t) = &auth.token {
                    req = req.bearer_auth(t);
                }
            }
            "basic" => {
                req = req.basic_auth(
                    auth.username.clone().unwrap_or_default(),
                    auth.password.clone(),
                );
            }
            "apikey" => {
                let key = auth.key.clone().unwrap_or_else(|| "X-API-Key".into());
                let val = auth.value.clone().unwrap_or_default();
                if auth.r#in.as_deref() == Some("query") {
                    req = req.query(&[(key, val)]);
                } else {
                    req = req.header(key, val);
                }
            }
            "" => {}
            other => return Err(format!("unknown auth type: {other}")),
        }
    }

    // Body.
    if let Some(body) = &spec.body {
        match spec.body_type.as_deref().unwrap_or("json") {
            "json" => req = req.json(body),
            "form" => {
                let form: Vec<(String, String)> = body
                    .as_object()
                    .map(|o| o.iter().map(|(k, v)| (k.clone(), v2s(v))).collect())
                    .unwrap_or_default();
                req = req.form(&form);
            }
            "text" | "raw" => req = req.body(v2s(body)),
            other => return Err(format!("unsupported bodyType: {other}")),
        }
    }

    let started = Instant::now();
    let resp = req.send().await.map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();

    let mut headers = Map::new();
    for (name, value) in resp.headers().iter() {
        headers.insert(
            name.as_str().to_lowercase(),
            Value::String(value.to_str().unwrap_or("").to_string()),
        );
    }

    let text = resp.text().await.map_err(|e| format!("failed reading body: {e}"))?;
    let time_ms = started.elapsed().as_millis() as u64;
    let body_json: Option<Value> = serde_json::from_str(&text).ok();

    Ok(build_result(
        resolved,
        Some(status.as_u16()),
        status.canonical_reason().unwrap_or("").to_string(),
        headers,
        body_json,
        text,
        time_ms,
        None,
    ))
}

/// Assemble the standard result document (assertions + extraction + summaries).
#[allow(clippy::too_many_arguments)]
fn build_result(
    resolved: &Value,
    status: Option<u16>,
    status_text: String,
    headers: Map<String, Value>,
    body_json: Option<Value>,
    body_text: String,
    time_ms: u64,
    graphql_errors: Option<Value>,
) -> String {
    let ctx = assert::Ctx {
        status,
        headers: &headers,
        body: body_json.as_ref(),
        body_text: Some(&body_text),
        time_ms,
    };

    let asserts: Vec<Value> = resolved
        .get("assert")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let report = assert::run(&ctx, &asserts);

    let extracted = resolved
        .get("extract")
        .and_then(|v| v.as_object())
        .map(|m| assert::extract(body_json.as_ref(), m))
        .unwrap_or_default();

    let (body_shape, body_bytes) = match &body_json {
        Some(b) => (optimizer::shape(b), optimizer::byte_len(b)),
        None => (
            json!({ "type": "text", "len": body_text.chars().count() }),
            body_text.len(),
        ),
    };
    let body_preview = body_json
        .as_ref()
        .map(|b| optimizer::truncate(b, 200, 20))
        .unwrap_or_else(|| Value::String(body_text.chars().take(2000).collect()));

    json!({
        "ok": report.ok(),
        "status": status,
        "statusText": status_text,
        "timeMs": time_ms,
        "headers": headers,
        "bodyJson": body_json,
        "bodyText": if body_json.is_some() { Value::Null } else { Value::String(body_text) },
        "bodyBytes": body_bytes,
        "bodyShape": body_shape,
        "bodyPreview": body_preview,
        "assertions": report,
        "extracted": extracted,
        "graphqlErrors": graphql_errors,
        "error": Value::Null,
    })
    .to_string()
}

pub async fn http_request(request_json: String) -> String {
    let (resolved, vars) = match resolve_spec(&request_json) {
        Ok(v) => v,
        Err(e) => return error_result(e),
    };
    let mut spec: HttpSpec = match serde_json::from_value(resolved.clone()) {
        Ok(s) => s,
        Err(e) => return error_result(format!("invalid http spec: {e}")),
    };
    // Re-resolve url explicitly (already resolved, but ensure string).
    spec.url = template::resolve_to_string(&spec.url, &vars);
    match perform(spec, &resolved).await {
        Ok(r) => r,
        Err(e) => error_result(e),
    }
}

const INTROSPECTION_QUERY: &str = "query IntrospectionQuery { __schema { \
queryType { name } mutationType { name } subscriptionType { name } \
types { \
  name kind \
  fields { name args { name type { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind } } } } } } } type { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind } } } } } } } \
  inputFields { name type { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind } } } } } } } \
  enumValues { name } \
} } }";

/// Format a GraphQL type reference into a compact string like `String!`, `[String!]`, `LoginInput!`.
fn type_str(t: &Value) -> String {
    let kind = t["kind"].as_str().unwrap_or("");
    match kind {
        "NON_NULL" => {
            let inner = type_str(&t["ofType"]);
            format!("{inner}!")
        }
        "LIST" => {
            let inner = type_str(&t["ofType"]);
            format!("[{inner}]")
        }
        _ => t["name"].as_str().unwrap_or("?").to_string(),
    }
}

/// Summarize a field's signature: `name(arg: Type, ...): ReturnType`.
fn field_sig(field: &Value, types: &[Value]) -> Value {
    let name = field["name"].as_str().unwrap_or("");
    let args: Vec<String> = field["args"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|a| {
            let an = a["name"].as_str().unwrap_or("");
            let at = type_str(&a["type"]);
            format!("{an}: {at}")
        })
        .collect();
    let ret = type_str(&field["type"]);
    // Inline 1-level subfields for object return types (skip scalars/enums to save tokens).
    let sub_fields = inline_fields(&field["type"], types, 1);
    let sig = if args.is_empty() {
        format!("{name}: {ret}")
    } else {
        format!("{name}({}): {ret}", args.join(", "))
    };
    if let Some(sf) = sub_fields {
        json!({ "sig": sig, "fields": sf })
    } else {
        json!({ "sig": sig })
    }
}

/// Return up to `depth` levels of field names for an object type, following non-null/list wrappers.
fn inline_fields(t: &Value, types: &[Value], depth: usize) -> Option<Vec<String>> {
    if depth == 0 {
        return None;
    }
    // Unwrap NON_NULL and LIST to find the named type.
    let mut cur = t;
    loop {
        let kind = cur["kind"].as_str().unwrap_or("");
        if kind == "NON_NULL" || kind == "LIST" {
            cur = &cur["ofType"];
            continue;
        }
        break;
    }
    let type_name = cur["name"].as_str()?;
    if type_name.starts_with("__") {
        return None;
    }
    let type_def = types.iter().find(|t2| t2["name"].as_str() == Some(type_name))?;
    if type_def["kind"].as_str() != Some("OBJECT") {
        return None;
    }
    let fields = type_def["fields"].as_array()?;
    let names: Vec<String> = fields.iter().filter_map(|f| f["name"].as_str().map(String::from)).take(20).collect();
    if names.is_empty() {
        None
    } else {
        Some(names)
    }
}

/// Summarize a raw introspection result into a compact, token-efficient schema view
/// that includes field signatures (args + return types) and 1-level nested field names.
fn summarize_schema(data: &Value) -> Value {
    let schema = &data["__schema"];
    let types = schema["types"].as_array().cloned().unwrap_or_default();

    // Build a lookup of root operation type names.
    let root_fields = |type_name: &Value| -> Vec<Value> {
        let name = match type_name.as_str() {
            Some(n) => n,
            None => return vec![],
        };
        types
            .iter()
            .find(|t| t["name"].as_str() == Some(name))
            .and_then(|t| t["fields"].as_array())
            .map(|fs| fs.iter().map(|f| field_sig(f, &types)).collect())
            .unwrap_or_default()
    };

    // Collect input types referenced by mutations (the most useful for building operations).
    let input_types: Vec<Value> = types
        .iter()
        .filter(|t| t["kind"].as_str() == Some("INPUT_OBJECT") && !t["name"].as_str().unwrap_or("").starts_with("__"))
        .map(|t| {
            let name = t["name"].as_str().unwrap_or("");
            let fields: Vec<String> = t["inputFields"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .map(|f| format!("{}: {}", f["name"].as_str().unwrap_or(""), type_str(&f["type"])))
                .collect();
            json!({ "name": name, "fields": fields })
        })
        .collect();

    // Collect enum types (useful for knowing valid values).
    let enum_types: Vec<Value> = types
        .iter()
        .filter(|t| t["kind"].as_str() == Some("ENUM") && !t["name"].as_str().unwrap_or("").starts_with("__"))
        .map(|t| {
            let name = t["name"].as_str().unwrap_or("");
            let values: Vec<String> = t["enumValues"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter_map(|v| v["name"].as_str().map(String::from))
                .take(30)
                .collect();
            json!({ "name": name, "values": values })
        })
        .collect();

    let type_names: Vec<String> = types
        .iter()
        .filter_map(|t| t["name"].as_str())
        .filter(|n| !n.starts_with("__"))
        .map(String::from)
        .collect();

    json!({
        "queries": root_fields(&schema["queryType"]["name"]),
        "mutations": root_fields(&schema["mutationType"]["name"]),
        "subscriptions": root_fields(&schema["subscriptionType"]["name"]),
        "inputTypes": input_types,
        "enums": enum_types,
        "typeCount": type_names.len(),
        "types": type_names,
    })
}

pub async fn graphql_introspect(request_json: String) -> String {
    let (resolved, _vars) = match resolve_spec(&request_json) {
        Ok(v) => v,
        Err(e) => return error_result(e),
    };
    let url = resolved.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if url.is_empty() {
        return error_result("graphql_introspect: missing url".into());
    }
    let mut headers = resolved.get("headers").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    headers
        .entry("content-type".to_string())
        .or_insert_with(|| Value::String("application/json".into()));

    let spec = HttpSpec {
        method: Some("POST".into()),
        url,
        headers,
        query: Map::new(),
        body: Some(json!({ "query": INTROSPECTION_QUERY })),
        body_type: Some("json".into()),
        auth: serde_json::from_value(resolved.get("auth").cloned().unwrap_or(Value::Null)).ok(),
        timeout_ms: resolved.get("timeoutMs").and_then(|v| v.as_u64()),
        follow_redirects: None,
    };
    let raw = match perform(spec, &resolved).await {
        Ok(r) => r,
        Err(e) => return error_result(e),
    };
    let mut out: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);
    if let Some(data) = out.get("bodyJson").and_then(|b| b.get("data")).cloned() {
        out["schema"] = summarize_schema(&data);
    } else if let Some(errors) = out.get("bodyJson").and_then(|b| b.get("errors")).cloned() {
        out["graphqlErrors"] = errors;
    }
    out.to_string()
}

pub async fn graphql_request(request_json: String) -> String {
    let (resolved, _vars) = match resolve_spec(&request_json) {
        Ok(v) => v,
        Err(e) => return error_result(e),
    };
    let url = resolved.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if url.is_empty() {
        return error_result("graphql: missing url".into());
    }
    let query = resolved.get("query").and_then(|v| v.as_str()).unwrap_or("");
    let variables = resolved.get("variables").cloned().unwrap_or(json!({}));

    // Build an http spec that POSTs the GraphQL envelope.
    let mut headers = resolved
        .get("headers")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    headers
        .entry("content-type".to_string())
        .or_insert_with(|| Value::String("application/json".into()));

    let spec = HttpSpec {
        method: Some("POST".into()),
        url,
        headers,
        query: Map::new(),
        body: Some(json!({ "query": query, "variables": variables })),
        body_type: Some("json".into()),
        auth: serde_json::from_value(resolved.get("auth").cloned().unwrap_or(Value::Null)).ok(),
        timeout_ms: resolved.get("timeoutMs").and_then(|v| v.as_u64()),
        follow_redirects: None,
    };

    // Execute, then re-annotate graphqlErrors from the parsed body.
    let raw = match perform(spec, &resolved).await {
        Ok(r) => r,
        Err(e) => return error_result(e),
    };
    let mut out: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);
    if let Some(body) = out.get("bodyJson").cloned() {
        if let Some(errors) = body.get("errors") {
            out["graphqlErrors"] = errors.clone();
        }
    }
    out.to_string()
}
