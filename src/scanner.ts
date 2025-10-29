#!/usr/bin/env node

import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
    // Get configuration from environment variables
    const sonarToken = process.env.SONAR_TOKEN;
    const sonarProjectKey =
      process.env.SONAR_PROJECT_KEY || "davide97g_sonar-autofixer";
    const sonarOrganization = process.env.SONAR_ORGANIZATION || "davide97g";

    // Validate required environment variables
    if (!sonarToken) {
      console.error("❌ Error: SONAR_TOKEN is not set in .env file");
      console.error("Please create a .env file with SONAR_TOKEN=your-token");
      process.exit(1);
    }

    console.log("🔍 Starting SonarQube local scan...");
    console.log(`📦 Project Key: ${sonarProjectKey}`);
    console.log(`🏢 Organization: ${sonarOrganization}`);

    // Check if sonar scanner is installed
    try {
      execSync("which sonar", { encoding: "utf8", stdio: "ignore" });
    } catch (error) {
      console.error("❌ Error: Sonar scanner (@sonar/scan) is not installed.");
      console.error(
        `Scanner check failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      console.error("Please install it with: npm install -g @sonar/scan");
      process.exit(1);
    }

    // Build sonar command arguments
    // Using same format as GitHub Actions workflow (-D prefix)
    // Adding dumpToFile to save results locally for local analysis
    const sonarArgs = [
      `-Dsonar.token=${sonarToken}`,
      `-Dsonar.projectKey=${sonarProjectKey}`,
      `-Dsonar.organization=${sonarOrganization}`,
      // Dump results to file locally for local analysis
      "-Dsonar.scanner.dumpToFile=.sonar/scanner-report.json",
    ];

    const command = `sonar ${sonarArgs.join(" ")}`;

    console.log("\n🚀 Running Sonar Scanner...");
    console.log(
      `Command: sonar ${sonarArgs
        .filter((arg) => !arg.includes("token"))
        .join(" ")} (token hidden)`
    );

    // Execute sonar scan
    execSync(command, {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });

    console.log("\n✅ Sonar scan completed successfully!");
    console.log("📁 Results saved to: .sonar/scanner-report.json");
    console.log(
      "💡 Note: This is a local scan. Results are saved to file for local analysis."
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error running Sonar scan:", errorMessage);

    // Provide helpful error messages
    if (
      (error as { status?: number }).status === 127 ||
      errorMessage.includes("command not found")
    ) {
      console.error(
        "\n💡 Tip: Install Sonar Scanner with: npm install -g @sonar/scan"
      );
    }

    const execError = error as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    if (execError.stdout || execError.stderr) {
      console.error("\nScanner output:");
      if (execError.stdout) console.error(execError.stdout.toString());
      if (execError.stderr) console.error(execError.stderr.toString());
    }

    process.exit(1);
  }
};

// Run the scan
runSonarScan();
