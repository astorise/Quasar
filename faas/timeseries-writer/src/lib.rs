use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StoredEvent {
    pub distinct_id: String,
    pub event: String,
    pub timestamp_ms: i64,
    pub region: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub properties: Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Chunk {
    pub base_timestamp_ms: i64,
    pub delta_of_delta_ms: Vec<i64>,
    pub events: Vec<StoredEvent>,
}

pub fn build_chunk(events: Vec<StoredEvent>) -> Chunk {
    let base_timestamp_ms = events
        .first()
        .map(|event| event.timestamp_ms)
        .unwrap_or_default();
    let mut previous_delta = 0;
    let mut previous_timestamp = base_timestamp_ms;
    let mut delta_of_delta_ms = Vec::with_capacity(events.len().saturating_sub(1));

    for event in events.iter().skip(1) {
        let delta = event.timestamp_ms - previous_timestamp;
        delta_of_delta_ms.push(delta - previous_delta);
        previous_delta = delta;
        previous_timestamp = event.timestamp_ms;
    }

    Chunk {
        base_timestamp_ms,
        delta_of_delta_ms,
        events,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_delta_of_delta_series() {
        let events = [1000, 1500, 2300]
            .into_iter()
            .map(|timestamp_ms| StoredEvent {
                distinct_id: "u1".into(),
                event: "click".into(),
                timestamp_ms,
                region: None,
                session_id: None,
                properties: Value::Null,
            })
            .collect();

        let chunk = build_chunk(events);

        assert_eq!(chunk.base_timestamp_ms, 1000);
        assert_eq!(chunk.delta_of_delta_ms, vec![500, 300]);
    }
}
