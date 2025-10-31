#!/usr/bin/env node

/**
 * Updates the schema file's $id field with the current package version.
 * This script is called during the release process via standard-version hooks.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

try {
  // Read package.json to get current version
  const packageJsonPath = join(rootDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const version = packageJson.version;

  if (!version) {
    console.error("❌ No version found in package.json");
    process.exit(1);
  }

  // Read schema file
  const schemaPath = join(rootDir, "schemas", "sonarflowrc.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

  // Update $id field with new version
  const oldId = schema.$id;
  schema.$id = `https://raw.githubusercontent.com/bitrockteam/sonarflow/v${version}/schemas/sonarflowrc.schema.json`;

  // Write updated schema
  writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + "\n", "utf8");

  console.log(`✅ Updated schema $id: ${oldId} → ${schema.$id}`);
} catch (error) {
  console.error(
    "❌ Error updating schema version:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
