//! Token optimizer: turns large response bodies into compact, model-friendly forms.
//! - `shape`: a structural skeleton (types, keys, array lengths, string previews).
//! - `truncate`: the real value but with long strings/arrays bounded and marked.

use serde_json::{json, Map, Value};

pub fn byte_len(v: &Value) -> usize {
    serde_json::to_string(v).map(|s| s.len()).unwrap_or(0)
}

/// A compact structural description of a value (no full payload).
pub fn shape(v: &Value) -> Value {
    match v {
        Value::Object(o) => {
            let keys: Vec<String> = o.keys().take(50).cloned().collect();
            json!({ "type": "object", "size": o.len(), "keys": keys })
        }
        Value::Array(a) => {
            let sample = a.first().map(shape).unwrap_or(Value::Null);
            json!({ "type": "array", "len": a.len(), "items": sample })
        }
        Value::String(s) => {
            let preview: String = s.chars().take(80).collect();
            json!({ "type": "string", "len": s.chars().count(), "preview": preview })
        }
        Value::Number(_) => json!({ "type": "number", "value": v }),
        Value::Bool(_) => json!({ "type": "boolean", "value": v }),
        Value::Null => json!({ "type": "null" }),
    }
}

/// Return the value with long strings truncated and arrays capped, preserving structure.
pub fn truncate(v: &Value, max_str: usize, max_arr: usize) -> Value {
    match v {
        Value::String(s) => {
            if s.chars().count() > max_str {
                let head: String = s.chars().take(max_str).collect();
                Value::String(format!("{head}…(+{} chars)", s.chars().count() - max_str))
            } else {
                v.clone()
            }
        }
        Value::Array(a) => {
            let mut out: Vec<Value> = a
                .iter()
                .take(max_arr)
                .map(|e| truncate(e, max_str, max_arr))
                .collect();
            if a.len() > max_arr {
                out.push(Value::String(format!("…(+{} more)", a.len() - max_arr)));
            }
            Value::Array(out)
        }
        Value::Object(o) => {
            let mut out = Map::new();
            for (k, val) in o {
                out.insert(k.clone(), truncate(val, max_str, max_arr));
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}
