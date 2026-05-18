# security Specification

## Purpose
Define token-driven row-level security and anonymous dashboard access rules for Quasar analytics.

## Requirements
### Requirement: Token-Driven Row-Level Security
WHEN an analytical query is executed by a user with explicit scope restrictions, the system SHALL inject those constraints into the data scanning engine.

#### Scenario: Enforcing Regional Scope
- GIVEN a user authenticated via OIDC with the claim `{ "region": "nouvelle-aquitaine" }`
- WHEN the user requests the conversion funnel dashboard
- THEN the `olap-engine` appends a hardcoded filter `event.properties.region == 'nouvelle-aquitaine'` to the storage execution node
- AND the final output only reflects events matching this specific predicate.

### Requirement: Anonymous Dashboard Access
WHEN a dashboard manifest specifies public visibility, unauthenticated requests SHALL be permitted to read pre-calculated non-sensitive materialized views.

#### Scenario: Requesting a Public Dashboard Without Token
- GIVEN a dashboard manifest with `{ "security": { "visibility": "public" } }`
- WHEN an anonymous visitor requests this dashboard view
- THEN the system returns the pre-computed JSON view from `view-builder` with a 200 OK status
- AND blocks any ad-hoc drill-down queries that require raw database scans.
