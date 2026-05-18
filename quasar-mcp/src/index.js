#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const schemas = new Map([
  ["telemetry-event", "schemas/telemetry-event.schema.json"],
  ["dashboard-manifest", "schemas/dashboard-manifest.schema.json"],
]);

export async function getSchema(name) {
  const schemaPath = schemas.get(name);
  if (!schemaPath) {
    throw new Error(`Unknown schema: ${name}`);
  }
  return JSON.parse(await readFile(resolve(root, schemaPath), "utf8"));
}

export async function listSchemas() {
  return [...schemas.keys()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] ?? "list";
  if (command === "list") {
    console.log(JSON.stringify(await listSchemas(), null, 2));
  } else if (command === "schema") {
    console.log(JSON.stringify(await getSchema(process.argv[3]), null, 2));
  } else {
    console.error("Usage: quasar-mcp [list|schema <name>]");
    process.exitCode = 1;
  }
}
