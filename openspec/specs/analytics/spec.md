# analytics Specification

## Purpose
Define the edge-native telemetry ingestion, query security, and dashboard schema contracts for Quasar analytics.
## Requirements
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

### Requirement: Lazy-Loaded Session Replay Module
WHEN session recording is initialized or sampled, the client architecture SHALL dynamically request the secondary recording script using native ES6 imports to minimize bootstrap footprint.

#### Scenario: On-Demand Replay Module Allocation
- GIVEN a webpage tracking via the `@quasar/analytics-core` module
- WHEN the recording configuration criteria evaluates to true
- THEN the application issues a dynamic `import()` call for `@quasar/analytics-replay`
- AND the primary bundle footprint remains unaffected during initial document evaluation.

### Requirement: Isolated High-Density Replay Ingestion
WHEN telemetry data containing structural DOM changes hits the `/telemetry/replay` gateway, the system SHALL isolate the workload onto the `replay-writer` FaaS module.

#### Scenario: Processing Heavy Web Layout Snapshots
- GIVEN an active Tachyon cluster
- WHEN a payload containing 250KB of serialized structural layout diffs is submitted
- THEN the request is routed onto the `replay-writer` workspace pool
- AND the block uses Zstd algorithm compression to record bytes directly into RedDB.

### Requirement: Rage Click Capture Behavior
WHEN a user triggers multiple unhandled interactions on an identical element within a short timeframe, the SDK SHALL emit a rage click telemetry signal.

#### Scenario: Frustrated User Input Capture
- GIVEN an active tracker instance on a web application
- WHEN a visitor clicks an unhandled button element 4 times within a 600ms timeframe
- THEN the tracker compiles a specific `rage_click` event structural payload
- AND places the item in the outbound storage delivery queue.

