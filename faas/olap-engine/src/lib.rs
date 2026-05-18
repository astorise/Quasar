use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryClaims {
    pub subject: String,
    pub region: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
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

impl From<JwtClaims> for QueryClaims {
    fn from(value: JwtClaims) -> Self {
        let mut scope_filters = value.scope_filters;
        if let Some(region) = value.region.clone() {
            scope_filters.entry("region".to_owned()).or_insert(region);
        }

        Self {
            subject: value.sub,
            region: value.region,
            roles: value.roles,
            scope_filters,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StorageFilter {
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalyticsQuery {
    pub metric: String,
    #[serde(default)]
    pub filters: BTreeMap<String, String>,
}

pub fn extract_claims_from_jwt(
    token: &str,
    secret: &[u8],
) -> Result<QueryClaims, jsonwebtoken::errors::Error> {
    let token = token.strip_prefix("Bearer ").unwrap_or(token);
    let data = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret),
        &Validation::default(),
    )?;
    Ok(data.claims.into())
}

pub fn compile_rls_filter(claims: &QueryClaims) -> StorageFilter {
    if claims.scope_filters.is_empty() {
        return StorageFilter {
            expression: "true".to_owned(),
        };
    }

    let expression = claims
        .scope_filters
        .iter()
        .map(|(key, value)| {
            format!(
                "event.properties.{} == '{}'",
                key,
                value.replace('\'', "\\'")
            )
        })
        .collect::<Vec<_>>()
        .join(" && ");

    StorageFilter { expression }
}

pub fn inject_authorization_predicates(
    mut query: AnalyticsQuery,
    claims: &QueryClaims,
) -> AnalyticsQuery {
    for (key, value) in &claims.scope_filters {
        query.filters.insert(key.clone(), value.clone());
    }
    query
}

pub fn intercept_query_payload(
    payload: &str,
    claims: &QueryClaims,
) -> Result<Value, serde_json::Error> {
    let query: AnalyticsQuery = serde_json::from_str(payload)?;
    let secured = inject_authorization_predicates(query, claims);
    serde_json::to_value(secured)
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
            roles: vec!["viewer".into()],
            scope_filters: [("region".to_owned(), "nouvelle-aquitaine".to_owned())].into(),
        });

        assert_eq!(
            filter.expression,
            "event.properties.region == 'nouvelle-aquitaine'"
        );
    }

    #[test]
    fn injects_scope_filters_into_query_payload() {
        let claims = QueryClaims {
            subject: "u1".into(),
            region: Some("nouvelle-aquitaine".into()),
            roles: vec![],
            scope_filters: [("region".to_owned(), "nouvelle-aquitaine".to_owned())].into(),
        };

        let secured =
            intercept_query_payload(r#"{"metric":"conversion","filters":{}}"#, &claims).unwrap();

        assert_eq!(secured["filters"]["region"], "nouvelle-aquitaine");
    }
}
