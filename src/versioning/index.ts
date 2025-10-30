#!/usr/bin/env node

import dotenv from "dotenv";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SonarIssueExtractor } from "../sonar/sonar-issue-extractor.js";
import chalk from "chalk";

dotenv.config();

interface Config {
  repoName: string;
  gitOrganization: string;
  sonarProjectKey: string;
  sonarOrganization?: string;
  gitProvider: "github" | "bitbucket";
  outputPath?: string;
  sonarBaseUrl?: string;
  publicSonar?: boolean;
  sonarMode?: "standard" | "custom";
  rulesFlavor?: "safe" | "vibe-coder" | "yolo";
  [key: string]: unknown;
}

interface SonarIssuesResponse {
  issues?: Array<{ severity?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/**
 * Loads configuration from .sonarflowrc.json
 * @returns Configuration object
 */
const loadConfiguration = (): Config => {
  const configPath = path.join(process.cwd(), ".sonarflowrc.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("Configuration file not found: .sonarflowrc.json");
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as Config;

  // Validate required configuration
  if (!config.gitProvider) {
    throw new Error("gitProvider is required in configuration");
  }

  if (!["github", "bitbucket"].includes(config.gitProvider)) {
    throw new Error("gitProvider must be either 'github' or 'bitbucket'");
  }

  return config;
};

/**
 * Detects PR ID based on the configured git provider
 * @param branch - Current git branch name
 * @param gitProvider - Git provider (github or bitbucket)
 * @returns PR ID if found, null otherwise
 */
const detectPrId = async (
  repoName: string,
  branch: string,
  organization: string,
  gitProvider: "github" | "bitbucket"
): Promise<string | null> => {
  const extractor = new SonarIssueExtractor();
  if (gitProvider === "github") {
    return await extractor.detectGitHubPrId(branch);
  }
  if (gitProvider === "bitbucket") {
    return await extractor.detectBitbucketPrId(branch, repoName, organization);
  }

  return null;
};

/**
 * Fetches SonarQube issues based on configuration and command line arguments
 * @param branchName - Optional branch name
 * @param sonarPrLink - Optional SonarQube PR link
 */
const fetchSonarIssues = async (
  branchName: string | null = null,
  sonarPrLink: string | null = null
): Promise<void> => {
  try {
    // Load configuration
    const config = loadConfiguration();
    console.log(chalk.blue(`🔧 Using configuration: ${JSON.stringify(config, null, 2)}`));

    // Get current git branch
    const currentBranch =
      branchName || execSync("git branch --show-current", { encoding: "utf8" }).trim();
    console.log(chalk.blue(`Current branch: ${currentBranch}`));

    // Initialize SonarQube extractor
    const extractor = new SonarIssueExtractor();

    let issues: SonarIssuesResponse;
    let usedSource: string;

    if (sonarPrLink) {
      // If PR link is provided, fetch issues from that PR
      console.log(chalk.blue(`Using provided SonarQube PR link: ${sonarPrLink}`));
      issues = await extractor.fetchIssuesForPr(sonarPrLink, config);
      usedSource = `PR: ${sonarPrLink}`;
    } else {
      // Try to automatically detect PR ID from current branch
      const detectedPrId = await detectPrId(
        config.repoName,
        currentBranch,
        config.gitOrganization,
        config.gitProvider
      );

      if (detectedPrId) {
        // Use detected PR ID
        console.log(chalk.green(`🚀 Using automatically detected PR ID: ${detectedPrId}`));
        issues = await extractor.fetchIssuesForPrId(detectedPrId, config);
        usedSource = `PR #${detectedPrId} (auto-detected from branch: ${currentBranch})`;
      } else {
        // Fallback to branch-based approach
        console.warn(chalk.yellow("📋 No PR detected, falling back to branch-based approach"));
        issues = await extractor.fetchIssuesForBranch(currentBranch, config);
        usedSource = currentBranch;

        // Fallback to develop if no issues found
        if (!issues.issues || issues.issues.length === 0) {
          console.warn(
            chalk.yellow("No issues found for current branch. Falling back to branch: develop")
          );
          issues = await extractor.fetchIssuesForBranch("develop", config);
          usedSource = "develop";
        }
      }
    }

    // Save issues to file
    const outputPath = config.outputPath || ".sonar/";
    const sonarDir = path.join(process.cwd(), outputPath);
    if (!fs.existsSync(sonarDir)) {
      fs.mkdirSync(sonarDir, { recursive: true });
    }

    const issuesPath = path.join(sonarDir, "issues.json");
    fs.writeFileSync(issuesPath, JSON.stringify(issues, null, 2));

    console.log(
      chalk.green(
        `✅ Successfully fetched ${issues.issues?.length || 0} issues (source: ${usedSource})`
      )
    );
    console.log(chalk.blue(`📁 Saved to: ${issuesPath}`));

    // Display summary
    if (issues.issues && issues.issues.length > 0) {
      const severityCounts: Record<string, number> = {};
      for (const issue of issues.issues) {
        const severity = issue.severity || "UNKNOWN";
        severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      }

      console.log(chalk.blue("\n📊 Issues by severity:"));
      const sortedEntries = Object.entries(severityCounts).sort(([, a], [, b]) => b - a);
      for (const [severity, count] of sortedEntries) {
        console.log(chalk.blue(`  ${severity}: ${count}`));
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Error fetching SonarQube issues: ${errorMessage}`));
    process.exit(1);
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const branchName = args[0] || null;
const sonarPrLink = args[1] || null;

// Execute the main function
await fetchSonarIssues(branchName, sonarPrLink);
