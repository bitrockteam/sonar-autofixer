#!/usr/bin/env node

import dotenv from "dotenv";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
  const tokenString = `${token}:`;
  const basicAuth = `Basic ${Buffer.from(tokenString).toString("base64")}`;

  return {
    Authorization: basicAuth,
  };
};

/**
 * Validates required configuration environment variables
 * @throws {Error} If any required configuration is missing
 */
const validateConfiguration = () => {
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
};

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
    const prNumberRegex =
      /(?:pr\/|PR\/|pull\/|PULL\/)(\d+)|(?:feat\/|feature\/|fix\/|bugfix\/).*?(\d+)/i;
    const prNumberMatch = prNumberRegex.exec(branch);
    if (prNumberMatch) {
      const prNumber = prNumberMatch[1] || prNumberMatch[2];
      console.log(`✅ Extracted PR #${prNumber} from branch name: ${branch}`);
      return prNumber;
    }

    console.log(`⚠️  No PR found for branch: ${branch}`);
    return null;
  } catch (error) {
    console.log(`⚠️  Could not detect PR ID: ${error.message}`);
    return null;
  }
};

/**
 * Ensures .sonar directory exists and saves issues to file
 * @param {Object} issues - Issues data to save
 * @param {string} usedSource - Source description for logging
 */
const saveIssuesToFile = (issues, usedSource) => {
  const sonarDir = path.join(process.cwd(), ".sonar");
  if (!fs.existsSync(sonarDir)) {
    fs.mkdirSync(sonarDir, { recursive: true });
  }

  const issuesPath = path.join(sonarDir, "issues.json");
  fs.writeFileSync(issuesPath, JSON.stringify(issues, null, 2));

  console.log(
    `✅ Successfully fetched ${
      issues.issues?.length || 0
    } issues (source: ${usedSource})`
  );
  console.log(`📁 Saved to: ${issuesPath}`);
};

/**
 * Displays summary of issues by severity
 * @param {Object} issues - Issues data
 */
const displayIssuesSummary = (issues) => {
  if (!issues.issues || issues.issues.length === 0) {
    return;
  }

  const severityCounts = {};
  for (const issue of issues.issues) {
    const severity = issue.severity || "UNKNOWN";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;
  }

  console.log("\n📊 Issues by severity:");
  const sortedEntries = Object.entries(severityCounts).sort(
    ([, a], [, b]) => b - a
  );
  for (const [severity, count] of sortedEntries) {
    console.log(`  ${severity}: ${count}`);
  }
};

/**
 * Builds URL for fetching issues by branch
 * @param {string} branch - Branch name
 * @returns {string} URL for fetching issues
 */
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

  let url = sonarBaseUrl;
  if (!url.includes("/api/issues/search")) {
    url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
    url = url.replace(/\/api\/issues$/, "");
    url = `${url}/api/issues/search`;
  }

  return `${url}?${params.toString()}`;
};

/**
 * Builds URL for fetching issues by PR link
 * @param {string} prLink - SonarCloud PR link
 * @returns {string} URL for fetching issues
 */
const buildUrlForPr = (prLink) => {
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

  let url = sonarBaseUrl;
  if (!url.includes("/api/issues/search")) {
    url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
    url = url.replace(/\/api\/issues$/, "");
    url = `${url}/api/issues/search`;
  }

  return `${url}?${params.toString()}`;
};

/**
 * Builds URL for fetching issues by PR ID
 * @param {string} prId - PR ID
 * @returns {string} URL for fetching issues
 */
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

  let url = sonarBaseUrl;
  if (!url.includes("/api/issues/search")) {
    url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
    url = url.replace(/\/api\/issues$/, "");
    url = `${url}/api/issues/search`;
  }

  return `${url}?${params.toString()}`;
};

/**
 * Handles SonarQube API response
 * @param {Response} response - Fetch response
 * @returns {Promise<Object>} Parsed JSON response
 */
const handleSonarResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
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

  return await response.json();
};

/**
 * Fetches issues for a branch
 * @param {string} branch - Branch name
 * @returns {Promise<Object>} Issues data
 */
const fetchIssuesForBranch = async (branch) => {
  const url = buildUrlForBranch(branch);
  console.log(
    `Fetching issues from: ${url.replace(/sonarToken=[^&]+/, "sonarToken=***")}`
  );

  const authHeaders = getSonarAuthHeaders(sonarToken);
  const response = await fetch(url, {
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  return await handleSonarResponse(response);
};

/**
 * Fetches issues for a PR link
 * @param {string} prLink - SonarCloud PR link
 * @returns {Promise<Object>} Issues data
 */
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

  return await handleSonarResponse(response);
};

/**
 * Fetches issues for a PR ID
 * @param {string} prId - PR ID
 * @returns {Promise<Object>} Issues data
 */
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

  return await handleSonarResponse(response);
};

/**
 * Fetches issues based on the provided source (PR link, detected PR ID, or branch)
 * @param {string|null} sonarPrLink - Optional SonarCloud PR link
 * @param {string} currentBranch - Current git branch name
 * @returns {Promise<{issues: Object, usedSource: string}>} Issues data and source description
 */
const fetchIssuesFromSource = async (sonarPrLink, currentBranch) => {
  if (sonarPrLink) {
    console.log(`Using provided SonarQube PR link: ${sonarPrLink}`);
    const issues = await fetchIssuesForPr(sonarPrLink);
    return { issues, usedSource: `PR: ${sonarPrLink}` };
  }

  const detectedPrId = await detectPrId(currentBranch);
  if (detectedPrId) {
    console.log(`🚀 Using automatically detected PR ID: ${detectedPrId}`);
    const issues = await fetchIssuesForPrId(detectedPrId);
    return {
      issues,
      usedSource: `PR #${detectedPrId} (auto-detected from branch: ${currentBranch})`,
    };
  }

  console.log("📋 No PR detected, falling back to branch-based approach");
  let issues = await fetchIssuesForBranch(currentBranch);
  let usedSource = currentBranch;

  if (!issues.issues || issues.issues.length === 0) {
    console.log(
      "No issues found for current branch. Falling back to branch: develop"
    );
    issues = await fetchIssuesForBranch("develop");
    usedSource = "develop";
  }

  return { issues, usedSource };
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

    validateConfiguration();

    const { issues, usedSource } = await fetchIssuesFromSource(
      sonarPrLink,
      currentBranch
    );

    saveIssuesToFile(issues, usedSource);
    displayIssuesSummary(issues);
  } catch (error) {
    console.error("❌ Error fetching SonarQube issues:", error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const branchName = args[0] || null;
const sonarPrLink = args[1] || null;

// Use top-level await
await fetchSonarIssues(sonarPrLink, branchName);
