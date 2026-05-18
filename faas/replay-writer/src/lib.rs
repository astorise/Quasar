use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReplayError {
    #[error("invalid replay payload: {0}")]
    InvalidPayload(#[from] serde_json::Error),
    #[error("missing session_id")]
    MissingSession,
    #[error("compression failed: {0}")]
    Compression(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ReplayChunkPayload {
    Dom { ts: i64, patches: Vec<Value> },
    Interaction { ts: i64, samples: Vec<InteractionSample> },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractionSample {
    pub kind: String,
    pub ts: i64,
    #[serde(default)]
    pub x: Option<f64>,
    #[serde(default)]
    pub y: Option<f64>,
    #[serde(default)]
    pub x_ratio: Option<f64>,
    #[serde(default)]
    pub y_ratio: Option<f64>,
    #[serde(default)]
    pub top: Option<f64>,
    #[serde(default)]
    pub ratio: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReplayPayload {
    pub session_id: String,
    pub chunks: Vec<ReplayChunkPayload>,
    #[serde(default)]
    pub reason: Option<String>,
}

/// A compressed block as it lands in RedDB under `replay:<session_id>`.
#[derive(Debug, Clone, PartialEq)]
pub struct StoredReplayBlock {
    pub partition: String,
    pub session_id: String,
    pub bytes: Vec<u8>,
    pub interaction_samples: Vec<DeltaSample>,
    pub original_size: usize,
    pub compressed_size: usize,
}

/// One mouse/scroll sample compressed via Gorilla-style delta-of-delta on the
/// numeric coordinates. Stored alongside the Zstd-compressed structural blob
/// so the OLAP engine can build heatmaps without parsing the replay stream.
#[derive(Debug, Clone, PartialEq)]
pub struct DeltaSample {
    pub kind: String,
    pub delta_of_delta_ts: i64,
    pub x_dd: Option<i64>,
    pub y_dd: Option<i64>,
}

/// Abstraction over the text compression backend so the workspace can build
/// offline. Production Wasm builds enable the `zstd` feature and use the
/// real binding from `zstd-sys`.
pub trait Compressor {
    fn compress(&self, input: &[u8]) -> Result<Vec<u8>, ReplayError>;
}

/// Pass-through compressor used by unit tests and `--no-default-features` builds.
/// It preserves the contract (`Vec<u8>` in, `Vec<u8>` out) without pulling in
/// the C-backed `zstd` crate.
#[derive(Debug, Default, Clone, Copy)]
pub struct IdentityCompressor;

impl Compressor for IdentityCompressor {
    fn compress(&self, input: &[u8]) -> Result<Vec<u8>, ReplayError> {
        Ok(input.to_vec())
    }
}

#[cfg(feature = "zstd")]
#[derive(Debug, Clone, Copy)]
pub struct ZstdCompressor {
    pub level: i32,
}

#[cfg(feature = "zstd")]
impl Default for ZstdCompressor {
    fn default() -> Self {
        Self { level: 3 }
    }
}

#[cfg(feature = "zstd")]
impl Compressor for ZstdCompressor {
    fn compress(&self, input: &[u8]) -> Result<Vec<u8>, ReplayError> {
        zstd::stream::encode_all(input, self.level).map_err(|e| ReplayError::Compression(e.to_string()))
    }
}

pub fn parse_payload(raw: &str) -> Result<ReplayPayload, ReplayError> {
    let payload: ReplayPayload = serde_json::from_str(raw)?;
    if payload.session_id.trim().is_empty() {
        return Err(ReplayError::MissingSession);
    }
    Ok(payload)
}

/// Split a payload into structural DOM bytes (compressed via Zstd in prod) and
/// the numeric interaction stream (packed via delta-of-delta).
pub fn process_payload<C: Compressor>(
    payload: ReplayPayload,
    compressor: &C,
) -> Result<StoredReplayBlock, ReplayError> {
    let mut structural = Vec::new();
    let mut interaction = Vec::new();
    for chunk in &payload.chunks {
        match chunk {
            ReplayChunkPayload::Dom { patches, .. } => structural.push(patches),
            ReplayChunkPayload::Interaction { samples, .. } => interaction.extend(samples.iter().cloned()),
        }
    }
    let structural_bytes = serde_json::to_vec(&structural)?;
    let original_size = structural_bytes.len();
    let compressed = compressor.compress(&structural_bytes)?;
    let interaction_samples = pack_interaction_stream(&interaction);
    Ok(StoredReplayBlock {
        partition: format!("replay:{}", payload.session_id),
        session_id: payload.session_id,
        compressed_size: compressed.len(),
        bytes: compressed,
        interaction_samples,
        original_size,
    })
}

/// Apply Gorilla-style delta-of-delta encoding on (timestamp, x, y) tuples
/// so mouse trails compress down to tiny varint streams in the storage layer.
pub fn pack_interaction_stream(samples: &[InteractionSample]) -> Vec<DeltaSample> {
    let mut packed = Vec::with_capacity(samples.len());
    let mut prev_ts = None::<i64>;
    let mut prev_ts_delta = 0i64;
    let mut prev_x = None::<i64>;
    let mut prev_x_delta = 0i64;
    let mut prev_y = None::<i64>;
    let mut prev_y_delta = 0i64;

    for sample in samples {
        let dd_ts = match prev_ts {
            None => {
                prev_ts = Some(sample.ts);
                sample.ts
            }
            Some(previous) => {
                let delta = sample.ts - previous;
                let dd = delta - prev_ts_delta;
                prev_ts = Some(sample.ts);
                prev_ts_delta = delta;
                dd
            }
        };
        let x_dd = sample.x.map(|x| pack_coordinate(x as i64, &mut prev_x, &mut prev_x_delta));
        let y_dd = sample.y.map(|y| pack_coordinate(y as i64, &mut prev_y, &mut prev_y_delta));
        packed.push(DeltaSample {
            kind: sample.kind.clone(),
            delta_of_delta_ts: dd_ts,
            x_dd,
            y_dd,
        });
    }
    packed
}

fn pack_coordinate(value: i64, prev: &mut Option<i64>, prev_delta: &mut i64) -> i64 {
    match *prev {
        None => {
            *prev = Some(value);
            value
        }
        Some(previous) => {
            let delta = value - previous;
            let dd = delta - *prev_delta;
            *prev = Some(value);
            *prev_delta = delta;
            dd
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_missing_session() {
        let raw = json!({ "session_id": "", "chunks": [] }).to_string();
        assert!(matches!(parse_payload(&raw), Err(ReplayError::MissingSession)));
    }

    #[test]
    fn compresses_dom_chunks_into_partition() {
        let payload = ReplayPayload {
            session_id: "session-1".into(),
            chunks: vec![ReplayChunkPayload::Dom {
                ts: 1,
                patches: vec![json!({ "op": "text", "target": "h1", "value": "hello" })],
            }],
            reason: None,
        };
        let block = process_payload(payload, &IdentityCompressor).unwrap();
        assert_eq!(block.partition, "replay:session-1");
        assert_eq!(block.session_id, "session-1");
        assert_eq!(block.original_size, block.compressed_size);
        assert!(!block.bytes.is_empty());
    }

    #[test]
    fn packs_mouse_trail_with_delta_of_delta() {
        let payload = ReplayPayload {
            session_id: "s".into(),
            chunks: vec![ReplayChunkPayload::Interaction {
                ts: 0,
                samples: vec![
                    InteractionSample { kind: "pointer".into(), ts: 100, x: Some(10.0), y: Some(20.0), x_ratio: None, y_ratio: None, top: None, ratio: None },
                    InteractionSample { kind: "pointer".into(), ts: 150, x: Some(12.0), y: Some(23.0), x_ratio: None, y_ratio: None, top: None, ratio: None },
                    InteractionSample { kind: "pointer".into(), ts: 200, x: Some(14.0), y: Some(26.0), x_ratio: None, y_ratio: None, top: None, ratio: None },
                ],
            }],
            reason: None,
        };
        let block = process_payload(payload, &IdentityCompressor).unwrap();
        let samples = block.interaction_samples;
        assert_eq!(samples.len(), 3);
        // Second and third samples have constant deltas (50ms, +2px, +3px),
        // so the delta-of-delta collapses to 0 after the first transition.
        assert_eq!(samples[2].delta_of_delta_ts, 0);
        assert_eq!(samples[2].x_dd, Some(0));
        assert_eq!(samples[2].y_dd, Some(0));
    }
}
