#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const email = process.env.BITBUCKET_EMAIL;
const apiToken = process.env.BITBUCKET_API_TOKEN;
const sonarBaseUrl = process.env.SONAR_BASE_URL;
const bitbucketBaseUrl = process.env.BITBUCKET_BASE_URL;

const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

/**
 * Fetches SonarQube issues for the current git branch and saves them to .sonar/issues.json.
 * If the current branch has 0 issues, it falls back to fetching from "develop".
 * Can automatically detect PR ID from current branch using Bitbucket API or use provided SonarQube PR link.
 *
 * Usage: node fetch-sonar-issues.js [sonar-pr-link]
 *
 * @param {string} sonarPrLink - Optional SonarQube PR link to fetch issues from
 */
async function fetchSonarIssues(sonarPrLink = null, branchName = null) {
  try {
    // Get current git branch
    const currentBranch =
      branchName ||
      execSync("git branch --show-current", {
        encoding: "utf8",
      }).trim();
    console.log(`Current branch: ${currentBranch}`);

    /**
     * Automatically detects PR ID from current branch using Bitbucket API
     * @param {string} branch - Current git branch name
     * @returns {Promise<string|null>} PR ID if found, null otherwise
     */
    const detectPrId = async (branch) => {
      try {
        // Try to get PR number from Bitbucket API using the branch name
        const bitbucketApiUrl = `${bitbucketBaseUrl}/pullrequests?q=source.branch.name="${branch}"`;
        console.log(`🔍 Checking for PR associated with branch: ${branch}`);
        const response = await fetch(bitbucketApiUrl, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.values && data.values.length > 0) {
            const prNumber = data.values[0].id;
            console.log(`✅ Found PR #${prNumber} for branch: ${branch}`);
            return prNumber.toString();
          }
        }

        // Fallback: try to extract PR number from branch name if it follows a pattern like "feat/BAT-1234" or "pr/1234"
        const prNumberMatch = branch.match(
          /(?:pr\/|PR\/|pull\/|PULL\/)(\d+)|(?:feat\/|feature\/|fix\/|bugfix\/).*?(\d+)/i
        );
        if (prNumberMatch) {
          const prNumber = prNumberMatch[1] || prNumberMatch[2];
          console.log(
            `✅ Extracted PR #${prNumber} from branch name: ${branch}`
          );
          return prNumber;
        }

        console.log(`⚠️  No PR found for branch: ${branch}`);
        return null;
      } catch (error) {
        console.log(`⚠️  Could not detect PR ID: ${error.message}`);
        return null;
      }
    };

    const buildUrlForBranch = (branch) => {
      const params = new URLSearchParams({
        branch,
        components: "bat",
        s: "FILE_LINE",
        inNewCodePeriod: "true",
        issueStatuses: "CONFIRMED,OPEN",
        ps: "100",
        facets:
          "cleanCodeAttributeCategories,impactSoftwareQualities,severities,types,impactSeverities,codeVariants",
        additionalFields: "_all",
        timeZone: "Europe/Rome",
      });
      return `${sonarBaseUrl}?${params.toString()}`;
    };

    const buildUrlForPr = (prLink) => {
      // Extract PR key from the SonarQube PR link
      // Expected format: https://eyecare-sonarqube.luxgroup.net/project/issues?id=bat&pullRequest=PR_KEY
      const prKeyMatch = prLink.match(/pullRequest=([^&]+)/);
      if (!prKeyMatch) {
        throw new Error(
          "Invalid SonarQube PR link format. Expected format: https://eyecare-sonarqube.luxgroup.net/project/issues?id=bat&pullRequest=PR_KEY"
        );
      }

      const prKey = prKeyMatch[1];
      const params = new URLSearchParams({
        pullRequest: prKey,
        components: "bat",
        s: "FILE_LINE",
        inNewCodePeriod: "true",
        issueStatuses: "CONFIRMED,OPEN",
        ps: "100",
        facets:
          "cleanCodeAttributeCategories,impactSoftwareQualities,severities,types,impactSeverities,codeVariants",
        additionalFields: "_all",
        timeZone: "Europe/Rome",
      });
      return `${sonarBaseUrl}?${params.toString()}`;
    };

    const buildUrlForPrId = (prId) => {
      const params = new URLSearchParams({
        pullRequest: prId,
        components: "bat",
        s: "FILE_LINE",
        inNewCodePeriod: "true",
        issueStatuses: "CONFIRMED,OPEN",
        ps: "100",
        facets:
          "cleanCodeAttributeCategories,impactSoftwareQualities,severities,types,impactSeverities,codeVariants",
        additionalFields: "_all",
        timeZone: "Europe/Rome",
      });
      return `${sonarBaseUrl}?${params.toString()}`;
    };

    const fetchIssuesForBranch = async (branch) => {
      const url = buildUrlForBranch(branch);
      console.log(`Fetching issues from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      return json;
    };

    const fetchIssuesForPr = async (prLink) => {
      const url = buildUrlForPr(prLink);
      console.log(`Fetching issues from PR: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      return json;
    };

    const fetchIssuesForPrId = async (prId) => {
      const url = buildUrlForPrId(prId);
      console.log(`Fetching issues from PR ID: ${prId}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      return json;
    };

    let issues;
    let usedSource;

    if (sonarPrLink) {
      // If PR link is provided, fetch issues from that PR
      console.log(`Using provided SonarQube PR link: ${sonarPrLink}`);
      issues = await fetchIssuesForPr(sonarPrLink);
      usedSource = `PR: ${sonarPrLink}`;
    } else {
      // Try to automatically detect PR ID from current branch
      const detectedPrId = await detectPrId(currentBranch);

      if (detectedPrId) {
        // Use detected PR ID
        console.log(`🚀 Using automatically detected PR ID: ${detectedPrId}`);
        issues = await fetchIssuesForPrId(detectedPrId);
        usedSource = `PR #${detectedPrId} (auto-detected from branch: ${currentBranch})`;
      } else {
        // Fallback to branch-based approach
        console.log("📋 No PR detected, falling back to branch-based approach");
        issues = await fetchIssuesForBranch(currentBranch);
        usedSource = currentBranch;

        // Fallback to develop if no issues found
        if (!issues.issues || issues.issues.length === 0) {
          console.log(
            "No issues found for current branch. Falling back to branch: develop"
          );
          issues = await fetchIssuesForBranch("develop");
          usedSource = "develop";
        }
      }
    }

    // Ensure .sonar directory exists
    const sonarDir = path.join(process.cwd(), ".sonar");
    if (!fs.existsSync(sonarDir)) {
      fs.mkdirSync(sonarDir, { recursive: true });
    }

    // Save issues to file
    const issuesPath = path.join(sonarDir, "issues.json");
    fs.writeFileSync(issuesPath, JSON.stringify(issues, null, 2));

    console.log(
      `✅ Successfully fetched ${
        issues.issues?.length || 0
      } issues (source: ${usedSource})`
    );
    console.log(`📁 Saved to: ${issuesPath}`);

    // Display summary
    if (issues.issues && issues.issues.length > 0) {
      const severityCounts = {};
      issues.issues.forEach((issue) => {
        const severity = issue.severity || "UNKNOWN";
        severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      });

      console.log("\n📊 Issues by severity:");
      Object.entries(severityCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([severity, count]) => {
          console.log(`  ${severity}: ${count}`);
        });
    }
  } catch (error) {
    console.error("❌ Error fetching SonarQube issues:", error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const branchName = args[0] || null;
const sonarPrLink = args[1] || null;

// Run the script
fetchSonarIssues(sonarPrLink, branchName);
