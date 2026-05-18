use jsonwebtoken::{encode, EncodingKey, Header};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use telemetry_bridge::{extract_claims_from_jwt, ingest, map_oidc_claims, validate_event};

const SECRET: &[u8] = b"test-secret-for-integration-tests";

fn make_token(claims: &Value) -> String {
    let claims: serde_json::Map<String, Value> = claims
        .as_object()
        .expect("claims must be object")
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(SECRET),
    )
    .expect("token encoding failed")
}

#[test]
fn validates_event_with_all_required_fields() {
    let payload = r#"{"distinct_id":"u1","event":"signup","timestamp":"2026-05-18T10:00:00Z","properties":{}}"#;
    let event = validate_event(payload).expect("valid event should parse");
    assert_eq!(event.distinct_id, "u1");
    assert_eq!(event.event, "signup");
}

#[test]
fn rejects_event_missing_distinct_id() {
    let payload =
        r#"{"distinct_id":"","event":"signup","timestamp":"2026-05-18T10:00:00Z","properties":{}}"#;
    assert!(validate_event(payload).is_err());
}

#[test]
fn rejects_event_missing_timestamp() {
    let payload = r#"{"distinct_id":"u1","event":"signup","timestamp":"","properties":{}}"#;
    assert!(validate_event(payload).is_err());
}

#[test]
fn maps_oidc_claims_to_capability_token() {
    let claims = json!({
        "sub": "user-42",
        "region": "bretagne",
        "roles": ["admin", "viewer"],
        "scope_filters": {"department": "sales"}
    });
    let token = map_oidc_claims(&claims);
    assert_eq!(token.subject, "user-42");
    assert_eq!(token.allowed_region.as_deref(), Some("bretagne"));
    assert!(token.roles.contains(&"admin".to_owned()));
    assert_eq!(
        token.scope_filters.get("department").map(String::as_str),
        Some("sales")
    );
    assert_eq!(
        token.scope_filters.get("region").map(String::as_str),
        Some("bretagne")
    );
}

#[test]
fn maps_region_claim_into_scope_filters() {
    let claims = json!({ "sub": "u1", "region": "nouvelle-aquitaine" });
    let token = map_oidc_claims(&claims);
    assert_eq!(
        token.scope_filters.get("region").map(String::as_str),
        Some("nouvelle-aquitaine")
    );
}

#[test]
fn extracts_valid_jwt_capability_token() {
    let claims = json!({
        "sub": "svc-account",
        "region": "idf",
        "roles": ["ingest"],
        "scope_filters": {},
        "exp": 9_999_999_999usize
    });
    let token = make_token(&claims);
    let cap = extract_claims_from_jwt(&token, SECRET).expect("valid JWT should decode");
    assert_eq!(cap.subject, "svc-account");
    assert_eq!(cap.allowed_region.as_deref(), Some("idf"));
}

#[test]
fn rejects_jwt_with_wrong_secret() {
    let claims = json!({ "sub": "u1", "exp": 9_999_999_999usize });
    let token = make_token(&claims);
    assert!(extract_claims_from_jwt(&token, b"wrong-secret").is_err());
}

#[test]
fn jwt_bearer_prefix_is_stripped() {
    let claims = json!({ "sub": "u1", "exp": 9_999_999_999usize });
    let raw_token = make_token(&claims);
    let bearer_token = format!("Bearer {raw_token}");
    let cap_raw = extract_claims_from_jwt(&raw_token, SECRET).expect("raw should decode");
    let cap_bearer = extract_claims_from_jwt(&bearer_token, SECRET).expect("bearer should decode");
    assert_eq!(cap_raw.subject, cap_bearer.subject);
}

#[test]
fn ingest_propagates_region_from_oidc_claims() {
    let payload = r#"{"distinct_id":"u1","event":"click","timestamp":"2026-05-18T10:00:00Z","properties":{}}"#;
    let claims = json!({ "sub": "u1", "region": "occitanie" });
    let event = ingest(payload, Some(&claims)).expect("ingest should succeed");
    assert_eq!(event.region.as_deref(), Some("occitanie"));
}

#[test]
fn ingest_preserves_explicit_event_region() {
    let payload = r#"{"distinct_id":"u1","event":"click","timestamp":"2026-05-18T10:00:00Z","region":"bretagne","properties":{}}"#;
    let claims = json!({ "sub": "u1", "region": "normandie" });
    let event = ingest(payload, Some(&claims)).expect("ingest should succeed");
    // Event-level region must not be overwritten by the OIDC token.
    assert_eq!(event.region.as_deref(), Some("bretagne"));
}

#[test]
fn ingest_with_no_claims_keeps_event_intact() {
    let payload = r#"{"distinct_id":"u1","event":"click","timestamp":"2026-05-18T10:00:00Z","properties":{"k":"v"}}"#;
    let event = ingest(payload, None).expect("ingest without claims should succeed");
    assert_eq!(event.distinct_id, "u1");
    assert!(event.region.is_none());
}

#[test]
fn scope_filters_include_multiple_dimensions() {
    let claims = json!({
        "sub": "u2",
        "scope_filters": { "region": "paca", "department": "bouches-du-rhone" }
    });
    let token = map_oidc_claims(&claims);
    let mut expected: BTreeMap<String, String> = BTreeMap::new();
    expected.insert("region".into(), "paca".into());
    expected.insert("department".into(), "bouches-du-rhone".into());
    assert_eq!(token.scope_filters, expected);
}
