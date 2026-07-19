//! WebSocket bounded sessions: connect, optionally send, collect frames until a stop
//! condition (max messages / max duration / a matching frame), then return a summary.

use crate::{assert, optimizer, template};
use futures_util::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::http::{HeaderName, HeaderValue};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

/// Build a tungstenite client request with headers/subprotocols from a resolved spec.
fn build_request(
    url: &str,
    resolved: &Value,
) -> Result<tokio_tungstenite::tungstenite::handshake::client::Request, String> {
    let mut request = url.into_client_request().map_err(|e| format!("bad url: {e}"))?;
    if let Some(headers) = resolved.get("headers").and_then(|v| v.as_object()) {
        for (k, v) in headers {
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(&v.as_str().map(|s| s.to_string()).unwrap_or_else(|| v.to_string())),
            ) {
                request.headers_mut().insert(name, val);
            }
        }
    }
    if let Some(subs) = resolved.get("subprotocols").and_then(|v| v.as_array()) {
        let joined = subs.iter().filter_map(|s| s.as_str()).collect::<Vec<_>>().join(", ");
        if let Ok(val) = HeaderValue::from_str(&joined) {
            request.headers_mut().insert(HeaderName::from_static("sec-websocket-protocol"), val);
        }
    }
    Ok(request)
}

fn frame_of(msg: &Message) -> Option<Value> {
    match msg {
        Message::Text(t) => Some(json!({ "type": "text", "text": t, "json": serde_json::from_str::<Value>(t).ok() })),
        Message::Binary(b) => Some(json!({ "type": "binary", "size": b.len() })),
        _ => None,
    }
}

fn err(msg: String) -> String {
    json!({ "ok": false, "connected": false, "error": msg }).to_string()
}

pub async fn ws_session(request_json: String) -> String {
    let raw: Value = match serde_json::from_str(&request_json) {
        Ok(v) => v,
        Err(e) => return err(format!("invalid ws spec: {e}")),
    };
    let vars = raw.get("vars").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    let resolved = template::resolve(&raw, &vars);

    let url = resolved.get("url").and_then(|v| v.as_str()).unwrap_or("");
    if url.is_empty() {
        return err("ws: missing url".into());
    }

    let mut request = match url.into_client_request() {
        Ok(r) => r,
        Err(e) => return err(format!("ws: bad url: {e}")),
    };
    if let Some(headers) = resolved.get("headers").and_then(|v| v.as_object()) {
        for (k, v) in headers {
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(&v.as_str().map(|s| s.to_string()).unwrap_or_else(|| v.to_string())),
            ) {
                request.headers_mut().insert(name, val);
            }
        }
    }
    if let Some(subs) = resolved.get("subprotocols").and_then(|v| v.as_array()) {
        let joined = subs.iter().filter_map(|s| s.as_str()).collect::<Vec<_>>().join(", ");
        if let Ok(val) = HeaderValue::from_str(&joined) {
            request.headers_mut().insert(HeaderName::from_static("sec-websocket-protocol"), val);
        }
    }

    let (stream, _resp) = match tokio_tungstenite::connect_async(request).await {
        Ok(s) => s,
        Err(e) => return err(format!("ws connect failed: {e}")),
    };
    let (mut write, mut read) = stream.split();

    // Send messages.
    if let Some(sends) = resolved.get("send").and_then(|v| v.as_array()) {
        for item in sends {
            let msg = if let Some(j) = item.get("json") {
                Message::Text(j.to_string())
            } else if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                Message::Text(t.to_string())
            } else {
                continue;
            };
            if let Err(e) = write.send(msg).await {
                return err(format!("ws send failed: {e}"));
            }
        }
    }

    // Collect config.
    let collect = resolved.get("collect").cloned().unwrap_or(json!({}));
    let max_messages = collect.get("maxMessages").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
    let max_ms = collect.get("maxDurationMs").and_then(|v| v.as_u64()).unwrap_or(5000);
    let until = collect.get("until").and_then(|v| v.as_object()).cloned();

    let deadline = Instant::now() + Duration::from_millis(max_ms);
    let mut frames: Vec<Value> = Vec::new();
    let mut note: Option<String> = None;

    while frames.len() < max_messages {
        let now = Instant::now();
        if now >= deadline {
            note = Some("stopped: maxDurationMs reached".into());
            break;
        }
        match timeout(deadline - now, read.next()).await {
            Ok(Some(Ok(Message::Text(t)))) => {
                let json_val: Option<Value> = serde_json::from_str(&t).ok();
                frames.push(json!({ "type": "text", "text": t, "json": json_val }));
                if let Some(m) = &until {
                    let jp = m.get("jsonpath").and_then(|v| v.as_str());
                    let target = jp
                        .and_then(|p| assert::select(frames.last().unwrap().get("json"), p))
                        .or_else(|| frames.last().unwrap().get("json").cloned());
                    if assert::matches_value(target.as_ref(), m) {
                        note = Some("stopped: until matched".into());
                        break;
                    }
                }
            }
            Ok(Some(Ok(Message::Binary(b)))) => {
                frames.push(json!({ "type": "binary", "size": b.len() }));
            }
            Ok(Some(Ok(Message::Close(_)))) => {
                note = Some("stopped: server closed".into());
                break;
            }
            Ok(Some(Ok(_))) => {}
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
    if frames.len() >= max_messages && note.is_none() {
        note = Some("stopped: maxMessages reached".into());
    }
    let _ = write.close().await;

    // Streaming assertions.
    let asserts: Vec<Value> = resolved.get("assert").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let report = run_stream_asserts(&frames, frames.len(), &asserts, "frame");

    let preview = optimizer::truncate(&Value::Array(frames.clone()), 200, 10);

    json!({
        "ok": report.ok(),
        "connected": true,
        "frameCount": frames.len(),
        "frames": frames,
        "framesPreview": preview,
        "assertions": report,
        "note": note,
        "error": Value::Null,
    })
    .to_string()
}

/// Shared streaming assertion runner for ws frames / sse events.
pub fn run_stream_asserts(
    items: &[Value],
    count: usize,
    asserts: &[Value],
    kind: &str,
) -> assert::AssertionReport {
    let mut report = assert::AssertionReport::default();
    for a in asserts {
        let obj = match a.as_object() {
            Some(o) => o,
            None => continue,
        };
        // anyFrame / anyEvent: matches if any item satisfies the matcher.
        let any_key = format!("any{}{}", kind[..1].to_uppercase(), &kind[1..]);
        if let Some(m) = obj.get(&any_key).and_then(|v| v.as_object()) {
            let jp = m.get("jsonpath").and_then(|v| v.as_str());
            let ok = items.iter().any(|it| {
                let body = it.get("json").or(Some(it));
                let target = jp.and_then(|p| assert::select(body, p)).or_else(|| body.cloned());
                assert::matches_value(target.as_ref(), m)
            });
            report.push(assert::AssertionResult {
                ok,
                skipped: false,
                desc: format!("{any_key}"),
                detail: (!ok).then(|| "no matching item".to_string()),
            });
            continue;
        }
        // count matchers
        let count_key = if kind == "event" { "eventCount" } else { "frameCount" };
        if let Some(m) = obj.get(count_key).and_then(|v| v.as_object()) {
            let ok = assert::matches_value(Some(&Value::from(count as u64)), m);
            report.push(assert::AssertionResult {
                ok,
                skipped: false,
                desc: count_key.to_string(),
                detail: (!ok).then(|| format!("count was {count}")),
            });
            continue;
        }
        // fall back to matching count via generic "messageCount"
        if let Some(m) = obj.get("messageCount").and_then(|v| v.as_object()) {
            let ok = assert::matches_value(Some(&Value::from(count as u64)), m);
            report.push(assert::AssertionResult {
                ok,
                skipped: false,
                desc: "messageCount".into(),
                detail: (!ok).then(|| format!("count was {count}")),
            });
        }
    }
    report
}

// ---------------------------------------------------------------------------
// Persistent WebSocket connections (ws_open / ws_send / ws_recv / ws_close).
// The socket lives on a background tokio task; frames are buffered for ws_recv.
// ---------------------------------------------------------------------------

struct Conn {
    out_tx: mpsc::UnboundedSender<Message>,
    frames: Arc<StdMutex<Vec<Value>>>,
    closed: Arc<AtomicBool>,
}

static CONNS: Lazy<StdMutex<HashMap<String, Conn>>> = Lazy::new(|| StdMutex::new(HashMap::new()));

pub async fn ws_open(request_json: String) -> String {
    let raw: Value = match serde_json::from_str(&request_json) {
        Ok(v) => v,
        Err(e) => return err(format!("invalid ws spec: {e}")),
    };
    let vars = raw.get("vars").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    let resolved = template::resolve(&raw, &vars);
    let url = resolved.get("url").and_then(|v| v.as_str()).unwrap_or("");
    if url.is_empty() {
        return err("ws_open: missing url".into());
    }
    let request = match build_request(url, &resolved) {
        Ok(r) => r,
        Err(e) => return err(format!("ws_open: {e}")),
    };
    let (stream, _resp) = match tokio_tungstenite::connect_async(request).await {
        Ok(s) => s,
        Err(e) => return err(format!("ws connect failed: {e}")),
    };
    let (mut write, mut read) = stream.split();

    let frames = Arc::new(StdMutex::new(Vec::<Value>::new()));
    let closed = Arc::new(AtomicBool::new(false));
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<Message>();

    // Send any initial messages.
    if let Some(sends) = resolved.get("send").and_then(|v| v.as_array()) {
        for item in sends {
            if let Some(j) = item.get("json") {
                let _ = out_tx.send(Message::Text(j.to_string()));
            } else if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                let _ = out_tx.send(Message::Text(t.to_string()));
            }
        }
    }

    let task_frames = frames.clone();
    let task_closed = closed.clone();
    tokio::spawn(async move {
        loop {
            tokio::select! {
                incoming = read.next() => match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(msg)) => {
                        if let Some(f) = frame_of(&msg) {
                            task_frames.lock().unwrap().push(f);
                        }
                    }
                    Some(Err(_)) => break,
                },
                outgoing = out_rx.recv() => match outgoing {
                    Some(m) => { if write.send(m).await.is_err() { break; } }
                    None => break,
                },
            }
        }
        let _ = write.close().await;
        task_closed.store(true, Ordering::SeqCst);
    });

    let handle = format!("ws_{}", uuid::Uuid::new_v4().simple());
    CONNS.lock().unwrap().insert(handle.clone(), Conn { out_tx, frames, closed });
    json!({ "ok": true, "connected": true, "handle": handle, "error": Value::Null }).to_string()
}

pub fn ws_send(handle: String, message_json: String) -> String {
    let msg: Value = serde_json::from_str(&message_json).unwrap_or(Value::Null);
    let text = if let Some(j) = msg.get("json") {
        j.to_string()
    } else if let Some(t) = msg.get("text").and_then(|v| v.as_str()) {
        t.to_string()
    } else {
        return err("ws_send: message needs json or text".into());
    };
    let conns = CONNS.lock().unwrap();
    match conns.get(&handle) {
        Some(c) => match c.out_tx.send(Message::Text(text)) {
            Ok(_) => json!({ "ok": true }).to_string(),
            Err(_) => err("ws_send: connection closed".into()),
        },
        None => err(format!("ws_send: unknown handle {handle}")),
    }
}

pub async fn ws_recv(request_json: String) -> String {
    let req: Value = serde_json::from_str(&request_json).unwrap_or(Value::Null);
    let handle = req.get("handle").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let max_messages = req.get("maxMessages").and_then(|v| v.as_u64()).unwrap_or(50) as usize;
    let max_ms = req.get("maxDurationMs").and_then(|v| v.as_u64()).unwrap_or(1000);

    let (frames_arc, closed_arc) = {
        let conns = CONNS.lock().unwrap();
        match conns.get(&handle) {
            Some(c) => (c.frames.clone(), c.closed.clone()),
            None => return err(format!("ws_recv: unknown handle {handle}")),
        }
    };

    let deadline = Instant::now() + Duration::from_millis(max_ms);
    loop {
        let has = !frames_arc.lock().unwrap().is_empty();
        if has || closed_arc.load(Ordering::SeqCst) || Instant::now() >= deadline {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }

    let mut buf = frames_arc.lock().unwrap();
    let take = buf.len().min(max_messages);
    let drained: Vec<Value> = buf.drain(..take).collect();
    json!({
        "ok": true,
        "frames": drained,
        "count": drained.len(),
        "remaining": buf.len(),
        "closed": closed_arc.load(Ordering::SeqCst),
        "error": Value::Null,
    })
    .to_string()
}

pub fn ws_close(handle: String) -> String {
    match CONNS.lock().unwrap().remove(&handle) {
        Some(_) => json!({ "ok": true, "closed": true }).to_string(),
        None => err(format!("ws_close: unknown handle {handle}")),
    }
}
