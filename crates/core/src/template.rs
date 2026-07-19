//! Variable templating: resolves `{{ name }}` placeholders and built-in functions
//! inside request specs. Values come from a merged variable map (env + extracted vars).

use once_cell::sync::Lazy;
use rand::Rng;
use regex::Regex;
use serde_json::{Map, Value};
use std::time::{SystemTime, UNIX_EPOCH};

static PLACEHOLDER: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\{\{\s*([^}]+?)\s*\}\}").unwrap());

/// Resolve a single placeholder expression to a JSON value (may be non-string).
fn resolve_expr(expr: &str, vars: &Map<String, Value>) -> Option<Value> {
    // Built-in functions first.
    match expr {
        "uuid" => return Some(Value::String(uuid::Uuid::new_v4().to_string())),
        "timestamp" => {
            let secs = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            return Some(Value::from(secs));
        }
        "now" => {
            // Milliseconds since epoch as a simple, dependency-free "now".
            let ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            return Some(Value::from(ms));
        }
        _ => {}
    }

    if let Some(inner) = expr.strip_prefix("randomInt(").and_then(|s| s.strip_suffix(')')) {
        let parts: Vec<i64> = inner
            .split(',')
            .filter_map(|p| p.trim().parse::<i64>().ok())
            .collect();
        let (min, max) = match parts.as_slice() {
            [a, b] => (*a, *b),
            [b] => (0, *b),
            _ => (0, 1_000_000),
        };
        let (lo, hi) = if min <= max { (min, max) } else { (max, min) };
        let v = rand::thread_rng().gen_range(lo..=hi);
        return Some(Value::from(v));
    }
    if expr == "randomInt" {
        let v = rand::thread_rng().gen_range(0..=1_000_000);
        return Some(Value::from(v));
    }

    // Otherwise treat as a (possibly dotted) variable path.
    lookup_path(vars, expr)
}

/// Look up a dotted path like `user.id` inside the vars map.
fn lookup_path(vars: &Map<String, Value>, path: &str) -> Option<Value> {
    let mut cur = Value::Object(vars.clone());
    for seg in path.split('.') {
        cur = cur.get(seg)?.clone();
    }
    Some(cur)
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// Resolve all placeholders inside a string. If the whole string is exactly a single
/// placeholder and the resolved value is non-string, the raw JSON value is returned.
fn resolve_string(s: &str, vars: &Map<String, Value>) -> Value {
    if let Some(cap) = PLACEHOLDER.captures(s) {
        if cap.get(0).unwrap().as_str() == s {
            // Exact single-placeholder string -> preserve the raw value type.
            if let Some(v) = resolve_expr(cap.get(1).unwrap().as_str().trim(), vars) {
                return v;
            }
            return Value::String(s.to_string());
        }
    }
    let out = PLACEHOLDER.replace_all(s, |cap: &regex::Captures| {
        resolve_expr(cap.get(1).unwrap().as_str().trim(), vars)
            .map(|v| value_to_string(&v))
            .unwrap_or_default()
    });
    Value::String(out.into_owned())
}

/// Recursively resolve templates throughout a JSON value.
pub fn resolve(value: &Value, vars: &Map<String, Value>) -> Value {
    match value {
        Value::String(s) => resolve_string(s, vars),
        Value::Array(arr) => Value::Array(arr.iter().map(|v| resolve(v, vars)).collect()),
        Value::Object(obj) => {
            let mut out = Map::new();
            for (k, v) in obj {
                out.insert(k.clone(), resolve(v, vars));
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

/// Convenience: resolve a value that is expected to be a string (e.g. a URL).
pub fn resolve_to_string(value: &str, vars: &Map<String, Value>) -> String {
    value_to_string(&resolve_string(value, vars))
}
