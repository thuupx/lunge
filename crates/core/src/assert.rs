//! Assertion engine. Each assertion is a JSON object; the type is inferred from its keys
//! (status / header / jsonpath / timeMs / not). Matchers (equals, contains, gt, ...) are
//! shared and also reused by the streaming (ws/sse) modules.

use serde::Serialize;
use serde_json::{Map, Value};

#[derive(Serialize)]
pub struct AssertionResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub skipped: bool,
    pub desc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Serialize, Default)]
pub struct AssertionReport {
    pub passed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub results: Vec<AssertionResult>,
}

impl AssertionReport {
    pub fn push(&mut self, r: AssertionResult) {
        if r.skipped {
            self.skipped += 1;
        } else if r.ok {
            self.passed += 1;
        } else {
            self.failed += 1;
        }
        self.results.push(r);
    }
    pub fn ok(&self) -> bool {
        self.failed == 0
    }
}

/// Context an assertion is evaluated against.
pub struct Ctx<'a> {
    pub status: Option<u16>,
    /// Header names lowercased -> value.
    pub headers: &'a Map<String, Value>,
    pub body: Option<&'a Value>,
    #[allow(dead_code)]
    pub body_text: Option<&'a str>,
    pub time_ms: u64,
}

fn as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

fn len_of(v: &Value) -> Option<usize> {
    match v {
        Value::String(s) => Some(s.chars().count()),
        Value::Array(a) => Some(a.len()),
        Value::Object(o) => Some(o.len()),
        _ => None,
    }
}

fn loose_eq(a: &Value, b: &Value) -> bool {
    if a == b {
        return true;
    }
    match (as_f64(a), as_f64(b)) {
        (Some(x), Some(y)) => (x - y).abs() < f64::EPSILON,
        _ => a.to_string().trim_matches('"') == b.to_string().trim_matches('"'),
    }
}

/// Validate the JSON body against an inline JSON Schema (draft auto-detected).
fn validate_schema(body: Option<&Value>, schema: &Value) -> (bool, String) {
    let Some(b) = body else {
        return (false, "no JSON body to validate against schema".to_string());
    };
    match jsonschema::validator_for(schema) {
        Ok(validator) => {
            let errors: Vec<String> = validator
                .iter_errors(b)
                .take(5)
                .map(|e| format!("{} (at {})", e, e.instance_path()))
                .collect();
            if errors.is_empty() {
                (true, String::new())
            } else {
                (false, errors.join("; "))
            }
        }
        Err(e) => (false, format!("invalid schema: {e}")),
    }
}

/// Run a selector like `$.a.b` or `$.items.length` against a JSON body.
/// Returns None when the path matches nothing (silent — for assertions).
pub fn select(body: Option<&Value>, path: &str) -> Option<Value> {
    select_with_error(body, path).ok().flatten()
}

/// Like `select` but returns an error string when the path fails to parse.
/// This lets `inspect_response` surface JSONPath syntax errors to the agent.
pub fn select_with_error(body: Option<&Value>, path: &str) -> Result<Option<Value>, String> {
    let body = match body {
        Some(b) => b,
        None => return Ok(None),
    };
    if let Some(base) = path.strip_suffix(".length") {
        let parent = select_with_error(Some(body), base)?;
        return Ok(parent.and_then(|p| len_of(&p).map(|n| Value::from(n as u64))));
    }
    let jp = serde_json_path::JsonPath::parse(path).map_err(|e| format!("jsonpath parse error: {e}"))?;
    let nodes = jp.query(body).all();
    match nodes.len() {
        0 => Ok(None),
        1 => Ok(Some(nodes[0].clone())),
        _ => Ok(Some(Value::Array(nodes.into_iter().cloned().collect()))),
    }
}

/// Apply all matcher keys present in `spec` to `actual`. Returns (pass, detail).
fn apply_matchers(actual: Option<&Value>, spec: &Map<String, Value>) -> (bool, String) {
    let mut checked = false;
    macro_rules! num_cmp {
        ($key:expr, $op:tt) => {
            if let Some(exp) = spec.get($key) {
                checked = true;
                let a = actual.and_then(as_f64);
                let e = as_f64(exp);
                match (a, e) {
                    (Some(a), Some(e)) if a $op e => {}
                    _ => return (false, format!("expected value {} {} {:?}, got {:?}", $key, stringify!($op), exp, actual)),
                }
            }
        };
    }

    if let Some(exp) = spec.get("exists") {
        checked = true;
        let want = exp.as_bool().unwrap_or(true);
        if actual.is_some() != want {
            return (false, format!("expected exists={} but was {}", want, actual.is_some()));
        }
    }
    if let Some(exp) = spec.get("equals") {
        checked = true;
        match actual {
            Some(a) if loose_eq(a, exp) => {}
            _ => return (false, format!("expected equals {:?}, got {:?}", exp, actual)),
        }
    }
    if let Some(exp) = spec.get("notEquals") {
        checked = true;
        if let Some(a) = actual {
            if loose_eq(a, exp) {
                return (false, format!("expected notEquals {:?}", exp));
            }
        }
    }
    if let Some(Value::Array(list)) = spec.get("in") {
        checked = true;
        match actual {
            Some(a) if list.iter().any(|e| loose_eq(a, e)) => {}
            _ => return (false, format!("expected one of {:?}, got {:?}", list, actual)),
        }
    }
    if let Some(exp) = spec.get("contains") {
        checked = true;
        let ok = match actual {
            Some(Value::String(s)) => s.contains(&exp.as_str().unwrap_or("").to_string())
                || s.contains(&exp.to_string().trim_matches('"').to_string()),
            Some(Value::Array(arr)) => arr.iter().any(|e| loose_eq(e, exp)),
            Some(Value::Object(o)) => exp.as_str().map(|k| o.contains_key(k)).unwrap_or(false),
            _ => false,
        };
        if !ok {
            return (false, format!("expected to contain {:?}, got {:?}", exp, actual));
        }
    }
    if let Some(Value::String(pat)) = spec.get("matches") {
        checked = true;
        let re = regex::Regex::new(pat);
        let text = match actual {
            Some(Value::String(s)) => s.clone(),
            Some(other) => other.to_string(),
            None => String::new(),
        };
        match re {
            Ok(re) if re.is_match(&text) => {}
            Ok(_) => return (false, format!("expected match /{}/, got {:?}", pat, text)),
            Err(e) => return (false, format!("invalid regex /{}/: {}", pat, e)),
        }
    }
    if let Some(exp) = spec.get("length") {
        checked = true;
        let l = actual.and_then(len_of);
        match (l, as_f64(exp)) {
            (Some(l), Some(e)) if (l as f64 - e).abs() < f64::EPSILON => {}
            _ => return (false, format!("expected length {:?}, got {:?}", exp, l)),
        }
    }
    num_cmp!("gt", >);
    num_cmp!("gte", >=);
    num_cmp!("lt", <);
    num_cmp!("lte", <=);
    num_cmp!("min", >=);
    num_cmp!("max", <=);

    if !checked {
        return (false, "assertion had no recognized matcher".to_string());
    }
    (true, String::new())
}

/// Evaluate a single assertion object against the context.
pub fn eval_one(ctx: &Ctx, a: &Value) -> AssertionResult {
    let obj = match a.as_object() {
        Some(o) => o,
        None => {
            return AssertionResult {
                ok: false,
                skipped: false,
                desc: "assertion must be an object".into(),
                detail: Some(a.to_string()),
            }
        }
    };

    // not: <assertion>
    if let Some(inner) = obj.get("not") {
        let inner_res = eval_one(ctx, inner);
        return AssertionResult {
            ok: !inner_res.ok,
            skipped: false,
            desc: format!("not({})", inner_res.desc),
            detail: if inner_res.ok {
                Some("negated assertion unexpectedly passed".into())
            } else {
                None
            },
        };
    }

    // schema: JSON Schema validation of the body.
    if let Some(schema) = obj.get("schema") {
        let (ok, detail) = validate_schema(ctx.body, schema);
        return AssertionResult {
            ok,
            skipped: false,
            desc: "schema".into(),
            detail: (!ok).then_some(detail),
        };
    }

    // status
    if let Some(exp) = obj.get("status") {
        let actual = ctx.status.map(|s| Value::from(s));
        let (ok, detail) = if let Some(m) = exp.as_object() {
            apply_matchers(actual.as_ref(), m)
        } else {
            (
                actual.as_ref().map(|a| loose_eq(a, exp)).unwrap_or(false),
                format!("expected status {}, got {:?}", exp, ctx.status),
            )
        };
        return AssertionResult {
            ok,
            skipped: false,
            desc: format!("status {}", exp),
            detail: (!ok).then_some(detail),
        };
    }

    // header
    if let Some(h) = obj.get("header").and_then(|v| v.as_object()) {
        let name = h.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
        let actual = ctx.headers.get(&name);
        let (ok, detail) = if h.contains_key("present") {
            let want = h.get("present").and_then(|v| v.as_bool()).unwrap_or(true);
            (
                actual.is_some() == want,
                format!("header {} present expected {}", name, want),
            )
        } else {
            apply_matchers(actual, h)
        };
        return AssertionResult {
            ok,
            skipped: false,
            desc: format!("header {}", name),
            detail: (!ok).then_some(detail),
        };
    }

    // timeMs
    if let Some(exp) = obj.get("timeMs") {
        let actual = Value::from(ctx.time_ms);
        let (ok, detail) = if let Some(m) = exp.as_object() {
            apply_matchers(Some(&actual), m)
        } else {
            (loose_eq(&actual, exp), format!("expected timeMs {}", exp))
        };
        return AssertionResult {
            ok,
            skipped: false,
            desc: format!("timeMs {}", exp),
            detail: (!ok).then_some(detail),
        };
    }

    // jsonpath
    if let Some(path) = obj.get("jsonpath").and_then(|v| v.as_str()) {
        let actual = select(ctx.body, path);
        let (ok, detail) = apply_matchers(actual.as_ref(), obj);
        return AssertionResult {
            ok,
            skipped: false,
            desc: format!("jsonpath {}", path),
            detail: (!ok).then_some(detail),
        };
    }

    AssertionResult {
        ok: false,
        skipped: false,
        desc: "unrecognized assertion".into(),
        detail: Some(a.to_string()),
    }
}

pub fn run(ctx: &Ctx, asserts: &[Value]) -> AssertionReport {
    let mut report = AssertionReport::default();
    for a in asserts {
        report.push(eval_one(ctx, a));
    }
    report
}

/// Extract variables from a JSON body via a map of `name -> jsonpath`.
pub fn extract(body: Option<&Value>, spec: &Map<String, Value>) -> Map<String, Value> {
    let mut out = Map::new();
    for (name, path) in spec {
        if let Some(p) = path.as_str() {
            if let Some(v) = select(body, p) {
                out.insert(name.clone(), v);
            }
        }
    }
    out
}

/// Shared matcher entry point for streaming modules (ws/sse).
pub fn matches_value(actual: Option<&Value>, spec: &Map<String, Value>) -> bool {
    apply_matchers(actual, spec).0
}
