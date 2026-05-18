use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TelemetryError {
    #[error("missing required field: {0}")]
    MissingField(&'static str),
    #[error("invalid json payload")]
    InvalidJson(#[from] serde_json::Error),
    #[error("invalid authorization token")]
    InvalidToken(#[from] jsonwebtoken::errors::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TelemetryEvent {
    pub distinct_id: String,
    pub event: String,
    pub timestamp: String,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub properties: Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CapabilityToken {
    pub subject: String,
    pub allowed_region: Option<String>,
    pub roles: Vec<String>,
    pub scope_filters: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JwtClaims {
    pub sub: String,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub scope_filters: BTreeMap<String, String>,
    #[serde(default)]
    pub exp: usize,
}

pub fn validate_event(payload: &str) -> Result<TelemetryEvent, TelemetryError> {
    let event: TelemetryEvent = serde_json::from_str(payload)?;
    if event.distinct_id.trim().is_empty() {
        return Err(TelemetryError::MissingField("distinct_id"));
    }
    if event.event.trim().is_empty() {
        return Err(TelemetryError::MissingField("event"));
    }
    if event.timestamp.trim().is_empty() {
        return Err(TelemetryError::MissingField("timestamp"));
    }
    Ok(event)
}

pub fn map_oidc_claims(claims: &Value) -> CapabilityToken {
    let scope_filters = claims
        .get("scope_filters")
        .and_then(Value::as_object)
        .map(|filters| {
            filters
                .iter()
                .filter_map(|(key, value)| value.as_str().map(|value| (key.clone(), value.to_owned())))
                .collect()
        })
        .unwrap_or_default();

    CapabilityToken {
        subject: claims
            .get("sub")
            .and_then(Value::as_str)
            .unwrap_or("anonymous")
            .to_owned(),
        allowed_region: claims
            .get("region")
            .and_then(Value::as_str)
            .map(str::to_owned),
        roles: claims
            .get("roles")
            .and_then(Value::as_array)
            .map(|roles| {
                roles
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_owned)
                    .collect()
            })
            .unwrap_or_default(),
        scope_filters,
    }
}

pub fn extract_claims_from_jwt(
    token: &str,
    secret: &[u8],
) -> Result<CapabilityToken, jsonwebtoken::errors::Error> {
    let token = token.strip_prefix("Bearer ").unwrap_or(token);
    let data = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret),
        &Validation::default(),
    )?;
    let mut scope_filters = data.claims.scope_filters;
    if let Some(region) = data.claims.region.clone() {
        scope_filters.entry("region".to_owned()).or_insert(region.clone());
    }

    Ok(CapabilityToken {
        subject: data.claims.sub,
        allowed_region: data.claims.region,
        roles: data.claims.roles,
        scope_filters,
    })
}

pub fn ingest(payload: &str, claims: Option<&Value>) -> Result<TelemetryEvent, TelemetryError> {
    let mut event = validate_event(payload)?;
    if let Some(token) = claims.map(map_oidc_claims) {
        if event.region.is_none() {
            event.region = token.allowed_region;
        }
    }
    Ok(event)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_event_and_maps_region() {
        let payload = r#"{"distinct_id":"u1","event":"signup","timestamp":"2026-05-18T10:00:00Z","properties":{}}"#;
        let claims = serde_json::json!({"sub":"u1","region":"nouvelle-aquitaine"});

        let event = ingest(payload, Some(&claims)).unwrap();

        assert_eq!(event.region.as_deref(), Some("nouvelle-aquitaine"));
    }

    #[test]
    fn maps_scope_filters_from_claims() {
        let claims = serde_json::json!({
            "sub": "u1",
            "roles": ["viewer"],
            "scope_filters": {"department": "electronics"}
        });

        let token = map_oidc_claims(&claims);

        assert_eq!(token.roles, vec!["viewer"]);
        assert_eq!(
            token.scope_filters.get("department").map(String::as_str),
            Some("electronics")
        );
    }
}
