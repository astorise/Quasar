use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryClaims {
    pub subject: String,
    pub region: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StorageFilter {
    pub expression: String,
}

pub fn compile_rls_filter(claims: &QueryClaims) -> StorageFilter {
    match claims.region.as_deref() {
        Some(region) => StorageFilter {
            expression: format!("event.region == '{}'", region.replace('\'', "\\'")),
        },
        None => StorageFilter {
            expression: "true".to_owned(),
        },
    }
}

pub fn funnel_conversion(step_counts: &[u64]) -> f64 {
    match (step_counts.first(), step_counts.last()) {
        (Some(first), Some(last)) if *first > 0 => *last as f64 / *first as f64,
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_region_filter() {
        let filter = compile_rls_filter(&QueryClaims {
            subject: "u1".into(),
            region: Some("nouvelle-aquitaine".into()),
        });

        assert_eq!(filter.expression, "event.region == 'nouvelle-aquitaine'");
    }
}
