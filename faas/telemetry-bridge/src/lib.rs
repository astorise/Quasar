use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TelemetryError {
    #[error("missing required field: {0}")]
    MissingField(&'static str),
    #[error("invalid json payload")]
    InvalidJson(#[from] serde_json::Error),
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
    }
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
}
