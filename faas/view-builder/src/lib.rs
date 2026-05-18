use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CdcEvent {
    pub metric: String,
    pub bucket: String,
    pub increment: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct MaterializedView {
    pub metrics: BTreeMap<String, BTreeMap<String, u64>>,
}

impl MaterializedView {
    pub fn apply(&mut self, event: CdcEvent) {
        let buckets = self.metrics.entry(event.metric).or_default();
        *buckets.entry(event.bucket).or_default() += event.increment;
    }
}

pub fn build_view(events: impl IntoIterator<Item = CdcEvent>) -> MaterializedView {
    let mut view = MaterializedView::default();
    for event in events {
        view.apply(event);
    }
    view
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accumulates_cdc_events() {
        let view = build_view([
            CdcEvent {
                metric: "signups".into(),
                bucket: "2026-05-18T10:00:00Z".into(),
                increment: 2,
            },
            CdcEvent {
                metric: "signups".into(),
                bucket: "2026-05-18T10:00:00Z".into(),
                increment: 3,
            },
        ]);

        assert_eq!(view.metrics["signups"]["2026-05-18T10:00:00Z"], 5);
    }
}
