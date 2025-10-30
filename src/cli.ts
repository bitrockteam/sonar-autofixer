#!/usr/bin/env node

import { Command } from "commander";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
dotenv.config();

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
 * Compare two semver-like strings (x.y.z). Returns 1 if a>b, -1 if a<b, 0 if equal.
 */
const compareSemver = (a: string, b: string): number => {
  const toParts = (v: string): number[] => v.split(".").map((p) => Number.parseInt(p, 10) || 0);
  const [a1, a2, a3] = toParts(a);
  const [b1, b2, b3] = toParts(b);
  if (a1 !== b1) return a1 > b1 ? 1 : -1;
  if (a2 !== b2) return a2 > b2 ? 1 : -1;
  if (a3 !== b3) return a3 > b3 ? 1 : -1;
  return 0;
};

/**
 * Get latest version from npm registry
 */
const fetchLatestVersion = async (packageName: string): Promise<string | null> => {
  return spawnSync("npm", ["view", packageName, "version", "--registry=https://npm.pkg.github.com"])
    .stdout.toString()
    .trim();
};

/**
 * Check for available updates and print guidance
 */
const checkForUpdates = async (): Promise<void> => {
  try {
    const packageName = packageJson.name as string;
    console.log(`Current version: ${currentVersion}`);
    const latest = await fetchLatestVersion(packageName);
    if (latest) {
      const cmp = compareSemver(latest, currentVersion);
      if (cmp > 0) {
        console.log(`New version available: ${latest}`);
        console.log("\nHow to upgrade:");
        console.log(`- npx ${packageName}@latest <command>`);
        console.log(`- or update your devDependency: npm i -D ${packageName}@latest`);
      } else {
        console.log("You're up to date.");
      }
    } else {
      console.log("Could not check npm registry for latest version.");
    }
    console.log("\nCommon commands with latest:");
    console.log(`- npx ${packageName}@latest init`);
    console.log(`- npx ${packageName}@latest fetch`);
    console.log(`- npx ${packageName}@latest scan`);
    console.log(`- npx ${packageName}@latest update`);
  } catch (error) {
    console.error("❌ Error checking for updates:", error);
  }
};

/**
 * Show update reminder (non-blocking)
 */
const showUpdateReminder = (): void => {
  const packageName = packageJson.name as string;
  console.log(
    `\n💡 Tip: Use 'npx ${packageName}@latest <command>' to always get the latest version`
  );
  console.log(`   Run 'npx ${packageName} update' to check for updates\n`);
};

// Handle explicit version flags to also show update info
const argv = process.argv.slice(2);
const requestedVersion = argv.includes("-v") || argv.includes("--version");
if (requestedVersion) {
  console.log(currentVersion);
  await checkForUpdates();
  process.exit(0);
}

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
