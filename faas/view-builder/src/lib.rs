use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CdcEvent {
    pub metric: String,
    pub bucket: String,
    pub increment: u64,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub scope: BTreeMap<String, String>,
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

pub fn build_tenant_view(
    events: impl IntoIterator<Item = CdcEvent>,
    tenant_id: &str,
    enforced_filters: &BTreeMap<String, String>,
) -> MaterializedView {
    build_view(events.into_iter().filter(|event| {
        event.tenant_id.as_deref() == Some(tenant_id)
            && enforced_filters
                .iter()
                .all(|(key, value)| event.scope.get(key) == Some(value))
    }))
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
                tenant_id: None,
                scope: BTreeMap::new(),
            },
            CdcEvent {
                metric: "signups".into(),
                bucket: "2026-05-18T10:00:00Z".into(),
                increment: 3,
                tenant_id: None,
                scope: BTreeMap::new(),
            },
        ]);

        assert_eq!(view.metrics["signups"]["2026-05-18T10:00:00Z"], 5);
    }

    #[test]
    fn builds_isolated_tenant_view() {
        let filters = [("region".to_owned(), "nouvelle-aquitaine".to_owned())].into();
        let view = build_tenant_view(
            [
                CdcEvent {
                    metric: "revenue".into(),
                    bucket: "2026-05-18T10:00:00Z".into(),
                    increment: 10,
                    tenant_id: Some("tenant-a".into()),
                    scope: [("region".to_owned(), "nouvelle-aquitaine".to_owned())].into(),
                },
                CdcEvent {
                    metric: "revenue".into(),
                    bucket: "2026-05-18T10:00:00Z".into(),
                    increment: 90,
                    tenant_id: Some("tenant-b".into()),
                    scope: [("region".to_owned(), "nouvelle-aquitaine".to_owned())].into(),
                },
            ],
            "tenant-a",
            &filters,
        );

        assert_eq!(view.metrics["revenue"]["2026-05-18T10:00:00Z"], 10);
    }
}
