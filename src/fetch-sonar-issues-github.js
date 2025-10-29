#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const githubToken = process.env.GITHUB_TOKEN;
const sonarToken = process.env.SONAR_TOKEN;
const sonarBaseUrlRaw =
  process.env.SONAR_BASE_URL || "https://sonarcloud.io/api/issues/search";
// Ensure we're using the API endpoint, not the web UI endpoint
const sonarBaseUrl = sonarBaseUrlRaw
  .replace(/\/project\/issues\/search$/, "/api/issues/search")
  .replace(/\/project\/issues$/, "/api/issues/search");
const sonarComponentKeys = process.env.SONAR_COMPONENT_KEYS;
const sonarOrganization = process.env.SONAR_ORGANIZATION;
const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;
const githubBaseUrl = process.env.GITHUB_API_URL || "https://api.github.com";

// SonarCloud/SonarQube API authentication
// According to SonarQube API docs: https://next.sonarqube.com/sonarqube/web_api/api/issues/search
// Authentication can be done via Basic Auth (token:empty) or token parameter
const getSonarAuthHeaders = (token) => {
  if (!token) return {};

  // SonarCloud/SonarQube typically uses Basic Auth: token as username, empty password
  // Format: Authorization: Basic base64(token:)
  const basicAuth = `Basic ${Buffer.from(`${token}:`).toString("base64")}`;

  return {
    Authorization: basicAuth,
  };
};

/**
 * Fetches SonarCloud issues for the current git branch and saves them to .sonar/issues.json.
 * If the current branch has 0 issues, it falls back to fetching from "develop".
 * Can automatically detect PR ID from current branch using GitHub API or use provided SonarCloud PR link.
 *
 * Usage: node fetch-sonar-issues-github.js [branch-name] [sonar-pr-link]
 *
 * @param {string} sonarPrLink - Optional SonarCloud PR link to fetch issues from
 * @param {string} branchName - Optional branch name to use instead of current branch
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

    // Validate configuration
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    if (!githubOwner || !githubRepo) {
      throw new Error(
        "GITHUB_OWNER and GITHUB_REPO environment variables are required"
      );
    }
    if (!sonarComponentKeys) {
      throw new Error("SONAR_COMPONENT_KEYS environment variable is required");
    }
    if (!sonarOrganization) {
      throw new Error("SONAR_ORGANIZATION environment variable is required");
    }
    if (!sonarToken) {
      throw new Error(
        "SONAR_TOKEN environment variable is required for SonarCloud API authentication"
      );
    }

    /**
     * Automatically detects PR number from current branch using GitHub API
     * @param {string} branch - Current git branch name
     * @returns {Promise<string|null>} PR number if found, null otherwise
     */
    const detectPrId = async (branch) => {
      try {
        // Try to get PR number from GitHub API using the branch name
        const githubApiUrl = `${githubBaseUrl}/repos/${githubOwner}/${githubRepo}/pulls?head=${githubOwner}:${branch}&state=open`;
        console.log(`🔍 Checking for PR associated with branch: ${branch}`);
        const response = await fetch(githubApiUrl, {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const prNumber = data[0].number;
            console.log(`✅ Found PR #${prNumber} for branch: ${branch}`);
            return prNumber.toString();
          }
        }

        // Also check closed PRs in case the branch is merged
        const closedPrUrl = `${githubBaseUrl}/repos/${githubOwner}/${githubRepo}/pulls?head=${githubOwner}:${branch}&state=all`;
        const closedResponse = await fetch(closedPrUrl, {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (closedResponse.ok) {
          const closedData = await closedResponse.json();
          if (Array.isArray(closedData) && closedData.length > 0) {
            const prNumber = closedData[0].number;
            console.log(
              `✅ Found PR #${prNumber} for branch: ${branch} (closed/merged)`
            );
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
        s: "FILE_LINE",
        issueStatuses: "OPEN,CONFIRMED",
        ps: "100",
        facets: "impactSoftwareQualities,impactSeverities",
        componentKeys: sonarComponentKeys,
        organization: sonarOrganization,
        branch: branch,
        additionalFields: "_all",
      });

      // Ensure URL ends with /api/issues/search, not /project/issues/search
      let url = sonarBaseUrl;
      if (!url.includes("/api/issues/search")) {
        url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
        url = url.replace(/\/api\/issues$/, "");
        url = `${url}/api/issues/search`;
      }

      return `${url}?${params.toString()}`;
    };

    const buildUrlForPr = (prLink) => {
      // Extract PR key from the SonarCloud/SonarQube PR link
      // Expected format: https://sonarcloud.io/project/issues?id=project&pullRequest=PR_KEY
      // or: https://sonarcloud.io/api/issues/search?pullRequest=PR_KEY
      const prKeyMatch = prLink.match(/pullRequest=([^&]+)/);
      if (!prKeyMatch) {
        throw new Error(
          "Invalid SonarCloud/SonarQube PR link format. Expected format: https://sonarcloud.io/project/issues?id=project&pullRequest=PR_KEY"
        );
      }

      const prKey = prKeyMatch[1];
      const params = new URLSearchParams({
        s: "FILE_LINE",
        issueStatuses: "OPEN,CONFIRMED",
        ps: "100",
        facets: "impactSoftwareQualities,impactSeverities",
        componentKeys: sonarComponentKeys,
        organization: sonarOrganization,
        pullRequest: prKey,
        additionalFields: "_all",
      });

      // Ensure URL ends with /api/issues/search
      let url = sonarBaseUrl;
      if (!url.includes("/api/issues/search")) {
        url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
        url = url.replace(/\/api\/issues$/, "");
        url = `${url}/api/issues/search`;
      }

      return `${url}?${params.toString()}`;
    };

    const buildUrlForPrId = (prId) => {
      const params = new URLSearchParams({
        s: "FILE_LINE",
        issueStatuses: "OPEN,CONFIRMED",
        ps: "100",
        facets: "impactSoftwareQualities,impactSeverities",
        componentKeys: sonarComponentKeys,
        organization: sonarOrganization,
        pullRequest: prId,
        additionalFields: "_all",
      });

      // Ensure URL ends with /api/issues/search
      let url = sonarBaseUrl;
      if (!url.includes("/api/issues/search")) {
        url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
        url = url.replace(/\/api\/issues$/, "");
        url = `${url}/api/issues/search`;
      }

      return `${url}?${params.toString()}`;
    };

    const fetchIssuesForBranch = async (branch) => {
      const url = buildUrlForBranch(branch);
      console.log(
        `Fetching issues from: ${url.replace(
          /sonarToken=[^&]+/,
          "sonarToken=***"
        )}`
      );

      const authHeaders = getSonarAuthHeaders(sonarToken);
      const response = await fetch(url, {
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error(`Unexpected content type: ${contentType}`);
        console.error(`Response preview: ${errorText.substring(0, 500)}`);
        throw new Error(
          `Expected JSON but got ${contentType}. Check authentication and API endpoint. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText.substring(
            0,
            200
          )}`
        );
      }
      const json = await response.json();
      return json;
    };

    const fetchIssuesForPr = async (prLink) => {
      const url = buildUrlForPr(prLink);
      console.log(
        `Fetching issues from PR: ${url.replace(
          /sonarToken=[^&]+/,
          "sonarToken=***"
        )}`
      );

      const authHeaders = getSonarAuthHeaders(sonarToken);
      const response = await fetch(url, {
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error(`Unexpected content type: ${contentType}`);
        console.error(`Response preview: ${errorText.substring(0, 500)}`);
        throw new Error(
          `Expected JSON but got ${contentType}. Check authentication and API endpoint. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText.substring(
            0,
            200
          )}`
        );
      }
      const json = await response.json();
      return json;
    };

    const fetchIssuesForPrId = async (prId) => {
      const url = buildUrlForPrId(prId);
      console.log(`Fetching issues from PR ID: ${prId}`);
      console.log(`URL: ${url.replace(/sonarToken=[^&]+/, "sonarToken=***")}`);

      const authHeaders = getSonarAuthHeaders(sonarToken);
      const response = await fetch(url, {
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error(`Unexpected content type: ${contentType}`);
        console.error(`Response preview: ${errorText.substring(0, 500)}`);
        throw new Error(
          `Expected JSON but got ${contentType}. Check authentication and API endpoint. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText.substring(
            0,
            200
          )}`
        );
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
