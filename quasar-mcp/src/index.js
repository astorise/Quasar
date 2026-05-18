#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const schemas = new Map([
  ["telemetry-event", "schemas/telemetry-event.schema.json"],
  ["dashboard-manifest", "schemas/dashboard-manifest.schema.json"],
  ["replay-payload", "schemas/replay-payload.schema.json"],
]);
const schemaNames = [...schemas.keys()];
const ajv = new Ajv2020({ allErrors: true, strict: false });

export async function getSchema(name) {
  const schemaPath = schemas.get(name);
  if (!schemaPath) {
    throw new Error(`Unknown schema: ${name}`);
  }
  return JSON.parse(await readFile(resolve(root, schemaPath), "utf8"));
}

export async function listSchemas() {
  return schemaNames;
}

export async function validateDashboard(manifest) {
  const schema = await getSchema("dashboard-manifest");
  const validate = ajv.compile(schema);
  const valid = validate(manifest);
  return {
    valid,
    errors: valid ? [] : validate.errors,
  };
}

export function createServer() {
  const server = new McpServer({
    name: "quasar-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "list_schemas",
    {
      title: "List Quasar schemas",
      description: "Return the canonical Quasar schema names available to agents.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await listSchemas(), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "get_schema",
    {
      title: "Get Quasar schema",
      description: "Return a canonical Quasar JSON schema by name.",
      inputSchema: {
        name: z.enum(schemaNames),
      },
    },
    async ({ name }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await getSchema(name), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "validate_dashboard",
    {
      title: "Validate Quasar dashboard",
      description: "Validate a dashboard manifest against the canonical JSON schema.",
      inputSchema: {
        manifest: z.record(z.any()),
      },
    },
    async ({ manifest }) => {
      const result = await validateDashboard(manifest);
      return {
        isError: !result.valid,
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "schema",
    new ResourceTemplate("quasar://schemas/{name}", {
      list: async () => ({
        resources: schemaNames.map((name) => ({
          uri: `quasar://schemas/${name}`,
          name,
          mimeType: "application/schema+json",
        })),
      }),
    }),
    {
      title: "Quasar schema",
      description: "Canonical Quasar JSON schema resource.",
      mimeType: "application/schema+json",
    },
    async (uri, { name }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/schema+json",
          text: JSON.stringify(await getSchema(name), null, 2),
        },
      ],
    }),
  );

  return server;
}

export async function runServer() {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? "list";
  if (command === "serve") {
    await runServer();
  } else if (command === "list") {
    console.log(JSON.stringify(await listSchemas(), null, 2));
  } else if (command === "schema") {
    console.log(JSON.stringify(await getSchema(process.argv[3]), null, 2));
  } else if (command === "validate-dashboard") {
    const manifest = JSON.parse(await readFile(resolve(process.cwd(), process.argv[3]), "utf8"));
    console.log(JSON.stringify(await validateDashboard(manifest), null, 2));
  } else {
    console.error("Usage: quasar-mcp [serve|list|schema <name>|validate-dashboard <file>]");
    process.exitCode = 1;
  }
}
