import chalk from "chalk";
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { SonarUrlBuilder } from "./sonar-url-builder.js";
import {
  extractPrNumberFromBranch,
  buildGitHubPrApiUrl,
  buildBitbucketPrApiUrl,
} from "./pr-detection-utils.js";

dotenv.config();

interface SonarIssue {
  severity?: string;
  [key: string]: unknown;
}

interface SonarResponse {
  issues?: SonarIssue[];
  [key: string]: unknown;
}

interface Config {
  repoName: string;
  gitOrganization: string;
  sonarProjectKey: string;
  sonarBaseUrl?: string;
  publicSonar?: boolean;
  gitProvider?: string;
  sonarOrganization?: string;
  sonarMode?: "standard" | "custom";
  rulesFlavor?: "safe" | "vibe-coder" | "yolo";
  [key: string]: unknown;
}

/**
 * SonarIssueExtractor - Handles all SonarQube API interactions and PR detection
 */
export class SonarIssueExtractor {
  private readonly gitEmail: string | undefined;
  private readonly gitToken: string | undefined;

  private readonly githubOwner: string | undefined;
  private readonly githubRepo: string | undefined;
  private readonly githubBaseUrl: string;
  private readonly bitbucketBaseUrl: string | undefined;

  private readonly sonarToken: string | undefined;
  private readonly sonarBaseUrlRaw: string;

  constructor() {
    // GitHub configuration
    this.gitToken = process.env.GIT_TOKEN;
    // Bitbucket configuration
    // Prefer env, fallback to local git config user.email
    const envGitEmail = process.env.GIT_EMAIL;
    let detectedGitEmail: string | undefined;
    if (!envGitEmail) {
      try {
        const email = execSync("git config --get user.email", {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
        detectedGitEmail = email || undefined;
      } catch {
        detectedGitEmail = undefined;
      }
    }
    this.gitEmail = envGitEmail || detectedGitEmail;

    this.githubOwner = process.env.GITHUB_OWNER;
    this.githubRepo = process.env.GITHUB_REPO;
    this.githubBaseUrl = process.env.GITHUB_API_URL || "https://api.github.com";

    this.bitbucketBaseUrl =
      process.env.BITBUCKET_BASE_URL || "https://api.bitbucket.org/2.0/repositories";

    // SonarQube configuration
    this.sonarToken = process.env.SONAR_TOKEN;
    this.sonarBaseUrlRaw = process.env.SONAR_BASE_URL || "https://sonarcloud.io/api/issues/search";
  }

  /**
   * Gets SonarQube authentication headers
   * @param token - SonarQube token
   * @returns Authentication headers
   */
  getSonarAuthHeaders(token?: string): Record<string, string> {
    if (!token) return {};

    // SonarCloud/SonarQube typically uses Basic Auth: token as username, empty password
    const tokenString = `${token}:`;
    const basicAuth = `Basic ${Buffer.from(tokenString).toString("base64")}`;

    return {
      Authorization: basicAuth,
    };
  }

  /**
   * Gets Bitbucket authentication headers
   * @returns Authentication headers
   */
  getBitbucketAuthHeaders(): Record<string, string> {
    if (!this.gitEmail || !this.gitToken) {
      throw new Error("GIT_EMAIL and GIT_TOKEN are required");
    }

    const auth = Buffer.from(`${this.gitEmail}:${this.gitToken}`).toString("base64");
    return {
      Authorization: `Basic ${auth}`,
    };
  }


  /**
   * Detects GitHub PR ID from branch name
   * @param branch - Branch name
   * @returns PR ID if found, null otherwise
   */
  async detectGitHubPrId(branch: string): Promise<string | null> {
    try {
      if (!this.gitToken || !this.githubOwner || !this.githubRepo) {
        console.warn(chalk.yellow("⚠️  GitHub configuration missing, skipping PR detection"));
        return null;
      }

      console.log(chalk.blue(`🔍 Checking for PR associated with branch: ${branch}`));

      // Try to get PR number from GitHub API using the branch name (open PRs first)
      const openPrUrl = buildGitHubPrApiUrl(this.githubBaseUrl, this.githubOwner, this.githubRepo, branch, "open");
      const openResponse = await fetch(openPrUrl, {
        headers: {
          Authorization: `token ${this.gitToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (openResponse.ok) {
        const data = (await openResponse.json()) as Array<{ number: number }>;
        if (Array.isArray(data) && data.length > 0) {
          const prNumber = data[0].number;
          console.log(chalk.green(`✅ Found PR #${prNumber} for branch: ${branch}`));
          return prNumber.toString();
        }
      }

      // Also check closed PRs in case the branch is merged
      const closedPrUrl = buildGitHubPrApiUrl(
        this.githubBaseUrl,
        this.githubOwner,
        this.githubRepo,
        branch,
        "all"
      );
      const closedResponse = await fetch(closedPrUrl, {
        headers: {
          Authorization: `token ${this.gitToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (closedResponse.ok) {
        const closedData = (await closedResponse.json()) as Array<{ number: number }>;
        if (Array.isArray(closedData) && closedData.length > 0) {
          const prNumber = closedData[0].number;
          console.log(
            chalk.green(`✅ Found PR #${prNumber} for branch: ${branch} (closed/merged)`)
          );
          return prNumber.toString();
        }
      }

      // Fallback: try to extract PR number from branch name
      const extractedPr = extractPrNumberFromBranch(branch);
      if (extractedPr) {
        return extractedPr;
      }

      console.warn(chalk.yellow(`⚠️  No PR found for branch: ${branch}`));
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`⚠️  Could not detect GitHub PR ID: ${errorMessage}`));
      return null;
    }
  }

  /**
   * Detects Bitbucket PR ID from branch name
   * @param branch - Branch name
   * @param repoName - Repository name
   * @param organization - Organization name
   * @returns PR ID if found, null otherwise
   */
  async detectBitbucketPrId(
    branch: string,
    repoName: string,
    organization: string
  ): Promise<string | null> {
    try {
      if (!this.gitEmail || !this.gitToken || !this.bitbucketBaseUrl) {
        console.warn(chalk.yellow("⚠️  Bitbucket configuration missing, skipping PR detection"));
        if (!this.gitEmail) {
          console.warn(chalk.yellow("⚠️  GIT_EMAIL is missing, skipping PR detection"));
        }
        if (!this.gitToken) {
          console.warn(chalk.yellow("⚠️  GIT_TOKEN is missing, skipping PR detection"));
        }
        if (!this.bitbucketBaseUrl) {
          console.warn(chalk.yellow("⚠️  BITBUCKET_BASE_URL is missing, skipping PR detection"));
        }
        return null;
      }

      console.log(chalk.blue(`🔍 Checking for PR associated with branch: ${branch}`));

      // Try to get PR number from Bitbucket API using the branch name
      const bitbucketApiUrl = buildBitbucketPrApiUrl(
        this.bitbucketBaseUrl,
        organization,
        repoName,
        branch
      );
      const response = await fetch(bitbucketApiUrl, {
        headers: this.getBitbucketAuthHeaders(),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          values?: Array<{ id: number }>;
        };
        if (data.values && data.values.length > 0) {
          const prNumber = data.values[0].id;
          console.log(chalk.green(`✅ Found PR #${prNumber} for branch: ${branch}`));
          return prNumber.toString();
        }
      }

      // Fallback: try to extract PR number from branch name
      const extractedPr = extractPrNumberFromBranch(branch);
      if (extractedPr) {
        return extractedPr;
      }

      console.warn(chalk.yellow(`⚠️  No PR found for branch: ${branch}`));
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(chalk.yellow(`⚠️  Could not detect Bitbucket PR ID: ${errorMessage}`));
      return null;
    }
  }

  /**
   * Handles SonarQube API response
   * @param response - Fetch response
   * @returns Parsed JSON response
   */
  async handleSonarResponse(response: Response): Promise<SonarResponse> {
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const errorText = await response.text();
      console.error(chalk.red(`Unexpected content type: ${contentType}`));
      console.error(chalk.red(`Response preview: ${errorText.substring(0, 500)}`));
      throw new Error(
        `Expected JSON but got ${contentType}. Check authentication and API endpoint. Status: ${response.status}`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`
      );
    }

    return (await response.json()) as SonarResponse;
  }

  /**
   * Creates a SonarUrlBuilder instance from configuration
   * @param config - Configuration object
   * @returns SonarUrlBuilder instance
   */
  private createUrlBuilder(config: Config): SonarUrlBuilder {
    const baseUrl = SonarUrlBuilder.normalizeUrl(config.sonarBaseUrl || this.sonarBaseUrlRaw);
    return new SonarUrlBuilder(baseUrl, config);
  }

  /**
   * Extracts PR key from a SonarQube PR link
   * @param prLink - SonarQube PR link
   * @returns PR key
   * @throws Error if the link format is invalid
   */
  private extractPrKeyFromLink(prLink: string): string {
    const prKeyMatch = prLink.match(/pullRequest=([^&]+)/);
    if (!prKeyMatch) {
      throw new Error(
        "Invalid SonarQube PR link format. Expected format: https://sonarcloud.io/project/issues?id=project&pullRequest=PR_KEY"
      );
    }
    return prKeyMatch[1];
  }

  /**
   * Fetches SonarQube issues using the provided URL builder options
   * @param config - Configuration object
   * @param options - URL building options (branch or pullRequest)
   * @param logMessage - Optional custom log message
   * @returns Issues data
   */
  private async fetchIssues(
    config: Config,
    options: { branch?: string; pullRequest?: string },
    logMessage?: string
  ): Promise<SonarResponse> {
    const urlBuilder = this.createUrlBuilder(config);
    const url = urlBuilder.buildUrl(options);

    if (logMessage) {
      console.log(chalk.blue(logMessage));
    }
    console.log(chalk.blue(`Fetching issues from: ${url.replace(/sonarToken=[^&]+/, "sonarToken=***")}`));

    const authHeaders = config.publicSonar ? {} : this.getSonarAuthHeaders(this.sonarToken);
    const response = await fetch(url, {
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return await this.handleSonarResponse(response);
  }

  /**
   * Fetches issues for a branch
   * @param branch - Branch name
   * @param config - Configuration object
   * @returns Issues data
   */
  async fetchIssuesForBranch(branch: string, config: Config): Promise<SonarResponse> {
    return await this.fetchIssues(config, { branch });
  }

  /**
   * Fetches issues for a PR link
   * @param prLink - SonarQube PR link
   * @param config - Configuration object
   * @returns Issues data
   */
  async fetchIssuesForPr(prLink: string, config: Config): Promise<SonarResponse> {
    const prKey = this.extractPrKeyFromLink(prLink);
    return await this.fetchIssues(config, { pullRequest: prKey }, `Fetching issues from PR: ${prLink}`);
  }

  /**
   * Fetches issues for a PR ID
   * @param prId - PR ID
   * @param config - Configuration object
   * @returns Issues data
   */
  async fetchIssuesForPrId(prId: string, config: Config): Promise<SonarResponse> {
    return await this.fetchIssues(
      config,
      { pullRequest: prId },
      `Fetching issues from PR ID: ${prId}`
    );
  }
}
