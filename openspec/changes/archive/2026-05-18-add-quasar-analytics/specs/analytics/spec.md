# Delta Spec: Quasar Analytics Pipeline

## ADDED Requirements

### Requirement: Edge Telemetry Ingestion
WHEN a client SDK sends a JSON telemetry payload to the edge node, the system SHALL validate it against the canonical event schema AND forward it to the Timeseries Writer component.

#### Scenario: Valid Payload Ingestion
- GIVEN an active Tachyon edge node
- WHEN a POST request with a valid JSON telemetry event is received at `/telemetry/ingest`
- THEN the system returns a 202 Accepted status
- AND the event is buffered in the `timeseries-writer` memory pool.

### Requirement: OIDC Security Pushdown
WHEN an authenticated user requests analytical data, the system SHALL evaluate their OIDC claims AND compile a restricted Wasm filter before querying the raw data.

#### Scenario: Region-Restricted User
- GIVEN a user with an OIDC claim restricting access to the `nouvelle-aquitaine` region
- WHEN the user loads a dashboard
- THEN the `olap-engine` strictly applies the region filter at the storage level
- AND only events originating from that region are returned to the UI.

### Requirement: Dashboard as Code Generation
WHEN a developer requests a dashboard structure via the MCP server, the system SHALL return the strict JSON schema required for rendering.

#### Scenario: Dashboard Schema Request
- GIVEN the Quasar MCP server is running
- WHEN a developer requests the `dashboard-manifest` schema
- THEN the server returns the canonical JSON schema for dashboard rendering.
