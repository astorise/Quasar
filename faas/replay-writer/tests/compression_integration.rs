use replay_writer::{
    pack_interaction_stream, parse_payload, process_payload, IdentityCompressor, InteractionSample,
    ReplayChunkPayload, ReplayError, ReplayPayload,
};
use serde_json::json;

// ── helpers ──────────────────────────────────────────────────────────────────

fn pointer(ts: i64, x: f64, y: f64) -> InteractionSample {
    InteractionSample {
        kind: "pointer".into(),
        ts,
        x: Some(x),
        y: Some(y),
        x_ratio: None,
        y_ratio: None,
        top: None,
        ratio: None,
    }
}

fn scroll(ts: i64, top: f64) -> InteractionSample {
    InteractionSample {
        kind: "scroll".into(),
        ts,
        x: None,
        y: None,
        x_ratio: None,
        y_ratio: None,
        top: Some(top),
        ratio: None,
    }
}

// ── parse_payload ─────────────────────────────────────────────────────────────

#[test]
fn parses_valid_payload() {
    let raw = json!({
        "session_id": "abc",
        "chunks": [{ "kind": "dom", "ts": 1, "patches": [] }]
    })
    .to_string();
    let p = parse_payload(&raw).unwrap();
    assert_eq!(p.session_id, "abc");
    assert_eq!(p.chunks.len(), 1);
}

#[test]
fn rejects_empty_session_id() {
    let raw = json!({ "session_id": "", "chunks": [] }).to_string();
    assert!(matches!(
        parse_payload(&raw),
        Err(ReplayError::MissingSession)
    ));
}

#[test]
fn rejects_invalid_json() {
    assert!(matches!(
        parse_payload("not-json"),
        Err(ReplayError::InvalidPayload(_))
    ));
}

// ── RedDB partition naming ────────────────────────────────────────────────────

#[test]
fn partition_key_uses_session_id() {
    let payload = ReplayPayload {
        session_id: "session-xyz".into(),
        chunks: vec![],
        reason: None,
    };
    let block = process_payload(payload, &IdentityCompressor).unwrap();
    assert_eq!(block.partition, "replay:session-xyz");
}

// ── IdentityCompressor preserves round-trip integrity ────────────────────────

#[test]
fn identity_compressor_round_trips_bytes() {
    let payload = ReplayPayload {
        session_id: "s1".into(),
        chunks: vec![ReplayChunkPayload::Dom {
            ts: 100,
            patches: vec![
                json!({"op": "add", "target": "body", "node": {"type": 1, "tag": "div"}}),
            ],
        }],
        reason: None,
    };
    let block = process_payload(payload, &IdentityCompressor).unwrap();
    assert_eq!(block.original_size, block.compressed_size);
    assert!(!block.bytes.is_empty());
    // The stored bytes must be valid JSON (structural snapshot).
    serde_json::from_slice::<serde_json::Value>(&block.bytes)
        .expect("identity-compressed bytes must be valid JSON");
}

// ── Delta-of-Delta parameterized matrix ──────────────────────────────────────

#[test]
fn constant_velocity_mouse_trail_collapses_to_zero_dod() {
    // Constant 50ms interval, constant +5px per step — delta is constant,
    // so delta-of-delta should be 0 for every step after the second.
    let samples: Vec<_> = (0..6)
        .map(|i| pointer(100 + i * 50, 10.0 + i as f64 * 5.0, 20.0))
        .collect();
    let packed = pack_interaction_stream(&samples);
    for sample in packed.iter().skip(2) {
        assert_eq!(
            sample.delta_of_delta_ts, 0,
            "ts DoD should be 0 for constant velocity"
        );
        assert_eq!(
            sample.x_dd,
            Some(0),
            "x DoD should be 0 for constant velocity"
        );
    }
}

#[test]
fn acceleration_produces_nonzero_dod() {
    // Accelerating mouse: intervals grow (+50, +60, +70 ms)
    let samples = vec![
        pointer(100, 0.0, 0.0),
        pointer(150, 5.0, 0.0),  // delta=50
        pointer(210, 10.0, 0.0), // delta=60
        pointer(280, 15.0, 0.0), // delta=70
    ];
    let packed = pack_interaction_stream(&samples);
    // third sample: delta=60, prev_delta=50, DoD=10
    assert_eq!(packed[2].delta_of_delta_ts, 10);
    // fourth sample: delta=70, prev_delta=60, DoD=10
    assert_eq!(packed[3].delta_of_delta_ts, 10);
}

#[test]
fn single_sample_has_raw_ts_as_dod() {
    let samples = vec![pointer(500, 30.0, 40.0)];
    let packed = pack_interaction_stream(&samples);
    assert_eq!(packed[0].delta_of_delta_ts, 500);
    assert_eq!(packed[0].x_dd, Some(30));
    assert_eq!(packed[0].y_dd, Some(40));
}

#[test]
fn empty_sample_list_produces_empty_output() {
    assert!(pack_interaction_stream(&[]).is_empty());
}

#[test]
fn scroll_samples_have_no_xy_dod() {
    let samples = vec![scroll(100, 0.0), scroll(200, 200.0)];
    let packed = pack_interaction_stream(&samples);
    assert!(packed[0].x_dd.is_none());
    assert!(packed[0].y_dd.is_none());
}

// ── Mixed chunk types ─────────────────────────────────────────────────────────

#[test]
fn interaction_samples_stored_separately_from_dom_bytes() {
    let payload = ReplayPayload {
        session_id: "mixed".into(),
        chunks: vec![
            ReplayChunkPayload::Dom {
                ts: 0,
                patches: vec![json!({"op": "text"})],
            },
            ReplayChunkPayload::Interaction {
                ts: 50,
                samples: vec![pointer(50, 10.0, 20.0), pointer(100, 15.0, 25.0)],
            },
        ],
        reason: Some("timer".into()),
    };
    let block = process_payload(payload, &IdentityCompressor).unwrap();
    assert_eq!(block.interaction_samples.len(), 2);
    assert!(!block.bytes.is_empty());
}

// ── Zstd feature-flag path (compile-time check only if feature enabled) ───────

#[cfg(feature = "zstd")]
#[test]
fn zstd_compressor_produces_smaller_or_equal_output_for_repetitive_input() {
    use replay_writer::ZstdCompressor;
    let compressor = ZstdCompressor::default();
    let repetitive: Vec<u8> = b"aaaa".repeat(256);
    let compressed = compressor.compress(&repetitive).unwrap();
    assert!(
        compressed.len() <= repetitive.len(),
        "zstd should not inflate repetitive data"
    );
}
