#!/usr/bin/env node

/**
 * Updates the schema file's $id field with the current package version.
 * This script is called during the release process via standard-version hooks.
 * Automatically commits the schema version change with a default message.
 */

import { execSync } from "node:child_process";
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

  // Stage and commit the schema file
  try {
    const schemaRelativePath = "schemas/sonarflowrc.schema.json";
    const commitMessage = `chore: update schema version to v${version}`;

    // Stage the schema file
    try {
      execSync(`git add ${schemaRelativePath}`, {
        cwd: rootDir,
        stdio: "pipe",
      });
    } catch (addError) {
      console.error("⚠️  Warning: Failed to stage schema file");
      throw addError;
    }

    // Commit with the default message
    try {
      execSync(`git commit -m "${commitMessage}"`, {
        cwd: rootDir,
        stdio: "pipe",
      });
      console.log(`✅ Committed schema version update: ${commitMessage}`);
    } catch (commitError) {
      // execSync throws an Error with the command output in the message
      const errorOutput = commitError instanceof Error ? commitError.message : String(commitError);

      // Check if git commit failed because there are no changes
      if (
        errorOutput.includes("nothing to commit") ||
        errorOutput.includes("no changes added to commit")
      ) {
        console.log("ℹ️  Schema version unchanged, skipping commit");
      } else {
        console.error("⚠️  Warning: Failed to commit schema version update:", errorOutput);
        // Don't fail the entire process if commit fails
      }
    }
  } catch (gitError) {
    // For any other git errors, log but don't fail
    console.error(
      "⚠️  Warning: Git operation failed:",
      gitError instanceof Error ? gitError.message : String(gitError)
    );
  }
} catch (error) {
  console.error(
    "❌ Error updating schema version:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
