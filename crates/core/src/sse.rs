//! Server-Sent Events bounded sessions: subscribe to an endpoint and collect events
//! until a stop condition (max events / max duration), then return a summary.

use crate::{optimizer, template, ws};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::time::{Duration, Instant};
use tokio::time::timeout;

fn err(msg: String) -> String {
    json!({ "ok": false, "connected": false, "error": msg }).to_string()
}

/// Parse a completed SSE event block (lines without the trailing blank line).
fn parse_event(lines: &[String]) -> Option<Value> {
    let mut event_type: Option<String> = None;
    let mut id: Option<String> = None;
    let mut data_lines: Vec<String> = Vec::new();
    for line in lines {
        if line.starts_with(':') {
            continue; // comment
        }
        let (field, value) = match line.split_once(':') {
            Some((f, v)) => (f, v.strip_prefix(' ').unwrap_or(v)),
            None => (line.as_str(), ""),
        };
        match field {
            "event" => event_type = Some(value.to_string()),
            "id" => id = Some(value.to_string()),
            "data" => data_lines.push(value.to_string()),
            _ => {}
        }
    }
    if data_lines.is_empty() && event_type.is_none() && id.is_none() {
        return None;
    }
    let data_raw = data_lines.join("\n");
    let data_json: Option<Value> = serde_json::from_str(&data_raw).ok();
    Some(json!({
        "event": event_type.unwrap_or_else(|| "message".into()),
        "id": id,
        "data": data_raw,
        "json": data_json,
    }))
}

pub async fn sse_session(request_json: String) -> String {
    let raw: Value = match serde_json::from_str(&request_json) {
        Ok(v) => v,
        Err(e) => return err(format!("invalid sse spec: {e}")),
    };
    let vars = raw.get("vars").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    let resolved = template::resolve(&raw, &vars);

    let url = resolved.get("url").and_then(|v| v.as_str()).unwrap_or("");
    if url.is_empty() {
        return err("sse: missing url".into());
    }

    let collect = resolved.get("collect").cloned().unwrap_or(json!({}));
    let max_events = collect.get("maxEvents").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
    let max_ms = collect.get("maxDurationMs").and_then(|v| v.as_u64()).unwrap_or(5000);

    let client = reqwest::Client::new();
    let mut req = client.get(url).header("Accept", "text/event-stream");
    if let Some(headers) = resolved.get("headers").and_then(|v| v.as_object()) {
        for (k, v) in headers {
            req = req.header(k, v.as_str().map(|s| s.to_string()).unwrap_or_else(|| v.to_string()));
        }
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => return err(format!("sse connect failed: {e}")),
    };
    let status = resp.status().as_u16();
    let mut stream = resp.bytes_stream();

    let deadline = Instant::now() + Duration::from_millis(max_ms);
    let mut buf = String::new();
    let mut cur: Vec<String> = Vec::new();
    let mut events: Vec<Value> = Vec::new();
    let mut note: Option<String> = None;

    'outer: while events.len() < max_events {
        let now = Instant::now();
        if now >= deadline {
            note = Some("stopped: maxDurationMs reached".into());
            break;
        }
        match timeout(deadline - now, stream.next()).await {
            Ok(Some(Ok(chunk))) => {
                buf.push_str(&String::from_utf8_lossy(&chunk));
                // Process complete lines.
                while let Some(nl) = buf.find('\n') {
                    let line = buf[..nl].trim_end_matches('\r').to_string();
                    buf.drain(..=nl);
                    if line.is_empty() {
                        if let Some(ev) = parse_event(&cur) {
                            events.push(ev);
                            if events.len() >= max_events {
                                note = Some("stopped: maxEvents reached".into());
                                break 'outer;
                            }
                        }
                        cur.clear();
                    } else {
                        cur.push(line);
                    }
                }
            }
            Ok(Some(Err(e))) => {
                note = Some(format!("stopped: read error: {e}"));
                break;
            }
            Ok(None) => {
                note = Some("stopped: stream ended".into());
                break;
            }
            Err(_) => {
                note = Some("stopped: maxDurationMs reached".into());
                break;
            }
        }
    }

    let asserts: Vec<Value> = resolved.get("assert").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let report = ws::run_stream_asserts(&events, events.len(), &asserts, "event");
    let preview = optimizer::truncate(&Value::Array(events.clone()), 200, 10);

    json!({
        "ok": report.ok(),
        "connected": true,
        "status": status,
        "eventCount": events.len(),
        "events": events,
        "eventsPreview": preview,
        "assertions": report,
        "note": note,
        "error": Value::Null,
    })
    .to_string()
}
