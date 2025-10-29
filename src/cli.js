#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "node:child_process";

// ESM-compatible __dirname/__filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name("sonar-autofixer")
  .description("CLI for sonar-autofixer")
  .version("1.0.0");

const runNodeScript = (relativeScriptPath, args = []) => {
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

program
  .command("init")
  .description("Initialize configuration for sonar-autofixer")
  .allowExcessArguments(true)
  .action(() => {
    runNodeScript("./init.js", process.argv.slice(3));
  });

program
  .command("fetch")
  .description("Fetch Sonar issues and save to .sonar/issues.json")
  .allowExcessArguments(true)
  .action(() => {
    runNodeScript("./versioning/index.js", process.argv.slice(3));
  });

program
  .command("scan")
  .description("Run local Sonar scanner and save report")
  .allowExcessArguments(true)
  .action(() => {
    runNodeScript("./scanner.js", process.argv.slice(3));
  });

program.parse(process.argv);
