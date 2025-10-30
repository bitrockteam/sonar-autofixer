#!/usr/bin/env node

import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Custom script to scan the repository with SonarQube locally
 * Similar to the GitHub Actions workflow but runs locally and saves results to file
 * Token is loaded from .env file via dotenv
 * Results are dumped to .sonar/scanner-report.json for local analysis
 */
const runSonarScan = (): void => {
  try {
    // Load optional configuration to detect public sonar
    const configPath = join(process.cwd(), ".sonarflowrc.json");
    let publicSonar = false;
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf8");
        const parsed = JSON.parse(raw) as { publicSonar?: boolean };
        publicSonar = Boolean(parsed.publicSonar);
      }
    } catch {
      publicSonar = false;
    }

    // Get configuration from environment variables
    const sonarToken = process.env.SONAR_TOKEN;
    const sonarProjectKey = process.env.SONAR_PROJECT_KEY || "bitrockteam_sonar-autofixer";
    const sonarOrganization = process.env.SONAR_ORGANIZATION || "bitrockteam";

    // Validate required environment variables only when private sonar
    if (!publicSonar && !sonarToken) {
      console.error(chalk.red("❌ Error: SONAR_TOKEN is not set in .env file"));
      console.error(
        chalk.red(
          "Please create a .env file with SONAR_TOKEN=your-token or set 'publicSonar' to true in .sonarflowrc.json"
        )
      );
      process.exit(1);
    }

    console.log(chalk.blue("🔍 Starting SonarQube local scan..."));
    console.log(chalk.blue(`📦 Project Key: ${sonarProjectKey}`));
    console.log(chalk.blue(`🏢 Organization: ${sonarOrganization}`));

    // Check if sonar scanner is installed
    try {
      execSync("which sonar", { encoding: "utf8", stdio: "ignore" });
    } catch (error) {
      console.error(chalk.red("❌ Error: Sonar scanner (@sonar/scan) is not installed."));
      console.error(
        chalk.red(`Scanner check failed: ${error instanceof Error ? error.message : String(error)}`)
      );
      console.error(chalk.red("Please install it with: npm install -g @sonar/scan"));
      process.exit(1);
    }

    // Build sonar command arguments
    // Using same format as GitHub Actions workflow (-D prefix)
    // Adding dumpToFile to save results locally for local analysis
    const sonarArgs = [
      // Only include token when sonar is private
      ...(publicSonar ? [] : [`-Dsonar.token=${sonarToken}`]),
      `-Dsonar.projectKey=${sonarProjectKey}`,
      `-Dsonar.organization=${sonarOrganization}`,
      // Dump results to file locally for local analysis
      "-Dsonar.scanner.dumpToFile=.sonar/scanner-report.json",
    ];

    const command = `sonar ${sonarArgs.join(" ")}`;

    console.log(chalk.blue("\n🚀 Running Sonar Scanner..."));
    console.log(
      chalk.blue(
        publicSonar
          ? `Command: sonar ${sonarArgs.join(" ")}`
          : `Command: sonar ${sonarArgs.filter((arg) => !arg.includes("token")).join(" ")} (token hidden)`
      )
    );

    // Execute sonar scan
    execSync(command, {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });

    console.log(chalk.green("\n✅ Sonar scan completed successfully!"));
    console.log(chalk.blue("📁 Results saved to: .sonar/scanner-report.json"));
    console.log(
      chalk.blue("💡 Note: This is a local scan. Results are saved to file for local analysis.")
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Error running Sonar scan: ${errorMessage}`));

    // Provide helpful error messages
    if (
      (error as { status?: number }).status === 127 ||
      errorMessage.includes("command not found")
    ) {
      console.error(chalk.red("\n💡 Tip: Install Sonar Scanner with: npm install -g @sonar/scan"));
    }

    const execError = error as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    if (execError.stdout || execError.stderr) {
      console.error(chalk.red("\nScanner output:"));
      if (execError.stdout) console.error(chalk.red(execError.stdout.toString()));
      if (execError.stderr) console.error(chalk.red(execError.stderr.toString()));
    }

    process.exit(1);
  }
};

// Run the scan
runSonarScan();
