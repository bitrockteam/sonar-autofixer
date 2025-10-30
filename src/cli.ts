#!/usr/bin/env node

import { Command } from "commander";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// Get current version from package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const currentVersion = packageJson.version;

program.name("sonar-autofixer").description("CLI for sonar-autofixer").version(currentVersion);

const runNodeScript = (relativeScriptPath: string, args: string[] = []): void => {
  const scriptPath = path.join(__dirname, relativeScriptPath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

/**
 * Check for available updates
 */
const checkForUpdates = async (): Promise<void> => {
  try {
    console.log("🔍 Checking for updates...");
    console.log(`Current version: ${currentVersion}`);

    const packageName = packageJson.name;

    console.log("\n🔄 To get the latest version, use:");
    console.log(`npx ${packageName}@latest <command>`);

    console.log("\n📝 Current commands:");
    console.log(`npx ${packageName}@latest init`);
    console.log(`npx ${packageName}@latest fetch`);
    console.log(`npx ${packageName}@latest scan`);
    console.log(`npx ${packageName}@latest update`);
  } catch (error) {
    console.error("❌ Error checking for updates:", error);
  }
};

/**
 * Show update reminder (non-blocking)
 */
const showUpdateReminder = (): void => {
  const packageName = packageJson.name;
  console.log(
    `\n💡 Tip: Use 'npx ${packageName}@latest <command>' to always get the latest version`
  );
  console.log(`   Run 'npx ${packageName} update' to check for updates\n`);
};

program
  .command("init")
  .description("Initialize configuration for sonar-autofixer")
  .allowExcessArguments(true)
  .action(() => {
    runNodeScript("./init.js", process.argv.slice(3));
    showUpdateReminder();
  });

program
  .command("fetch")
  .description("Fetch Sonar issues and save to .sonar/issues.json")
  .allowExcessArguments(true)
  .action(() => {
    runNodeScript("./versioning/index.js", process.argv.slice(3));
    showUpdateReminder();
  });

program
  .command("scan")
  .description("Run local Sonar scanner and save report")
  .allowExcessArguments(true)
  .action(() => {
    runNodeScript("./sonar/scanner.js", process.argv.slice(3));
    showUpdateReminder();
  });

program
  .command("update")
  .description("Check for updates and show how to get the latest version")
  .action(async () => {
    await checkForUpdates();
  });

program.parse(process.argv);
