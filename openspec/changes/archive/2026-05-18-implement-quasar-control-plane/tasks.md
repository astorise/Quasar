# Implementation Tasks

## MCP Server Implementation
- [x] Initialize the `@modelcontextprotocol/sdk` in `quasar-mcp/package.json`.
- [x] Implement the `list_schemas` tool in `quasar-mcp/src/index.js`.
- [x] Implement the `get_schema` resource reader for the telemetry and dashboard JSON schemas.
- [x] Implement the `validate_dashboard` tool using a JSON schema validator (e.g., `ajv`).
- [x] Add the MCP server run command to the workspace root `package.json`.

## VS Code Extension Implementation
- [x] Update `quasar-vscode/package.json` to contribute JSON schema validation for `*.dashboard.json` files.
- [x] Implement the `quasar.syncDashboard` command logic in `quasar-vscode/src/extension.js` to parse the active document.
- [x] Add child_process execution in the extension to call `tachyon config put <dashboard-id> <file>` for deployment.
- [x] Add status bar feedback (Success/Error) based on the Tachyon CLI output.
- [x] Create a sample `main.dashboard.json` file in the workspace root to test the intellisense and MCP integration.
