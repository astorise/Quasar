# control-plane Specification

## Purpose
Define the MCP and IDE control-plane contracts for exposing Quasar schemas to agents and synchronizing dashboard manifests to the Tachyon mesh.

## Requirements
### Requirement: AI Context Exposure via MCP
WHEN an AI agent queries the Quasar MCP server for schemas, the system SHALL return the exact JSON schema definitions to ensure accurate dashboard generation.

#### Scenario: Agent Dashboard Generation
- GIVEN the Quasar MCP server is connected to the agent's context
- WHEN the agent executes the `get_schema` tool for `dashboard-manifest`
- THEN the MCP server returns the JSON schema defining the grid layout, widgets, and metric queries
- AND the agent can generate a valid `.dashboard.json` file without syntax hallucinations.

### Requirement: IDE Dashboard Synchronization
WHEN a developer triggers the sync command in VS Code on a valid dashboard manifest, the system SHALL push the configuration to the Tachyon mesh.

#### Scenario: Successful Sync
- GIVEN a developer has an active, valid JSON document matching the Quasar dashboard schema
- WHEN the command `quasar.syncDashboard` is executed
- THEN the extension invokes the Tachyon CLI
- AND the manifest is written to the mesh's distributed storage
- AND the IDE displays a success notification.
