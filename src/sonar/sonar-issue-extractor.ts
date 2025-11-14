import { execSync } from "node:child_process";
import chalk from "chalk";
import dotenv from "dotenv";
import {
  buildBitbucketPrApiUrl,
  buildGitHubPrApiUrl,
  extractPrNumberFromBranch,
} from "./pr-detection-utils.js";
import { SonarUrlBuilder } from "./sonar-url-builder.js";

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
    this.githubBaseUrl = "https://api.github.com";

    this.bitbucketBaseUrl = "https://api.bitbucket.org/2.0/repositories";

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
      const openPrUrl = buildGitHubPrApiUrl(
        this.githubBaseUrl,
        this.githubOwner,
        this.githubRepo,
        branch,
        "open"
      );
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
      // First check for open PRs
      const openPrUrl = `${this.bitbucketBaseUrl}/${organization}/${repoName}/pullrequests?q=source.branch.name="${branch}" AND state="OPEN"`;
      const openResponse = await fetch(openPrUrl, {
        headers: this.getBitbucketAuthHeaders(),
      });

      if (openResponse.ok) {
        const openData = (await openResponse.json()) as {
          values?: Array<{ id: number; state: string }>;
        };
        if (openData.values && openData.values.length > 0) {
          const prNumber = openData.values[0].id;
          console.log(chalk.green(`✅ Found PR #${prNumber} for branch: ${branch}`));
          return prNumber.toString();
        }
      }

      // If no open PR found, check for all PRs (including merged/declined)
      const allPrUrl = buildBitbucketPrApiUrl(
        this.bitbucketBaseUrl,
        organization,
        repoName,
        branch
      );

      console.log(chalk.blue(`All PR URL: ${allPrUrl}`));
      console.log(
        chalk.blue(`All PR headers: ${JSON.stringify(this.getBitbucketAuthHeaders(), null, 2)}`)
      );
      const allResponse = await fetch(allPrUrl, {
        headers: this.getBitbucketAuthHeaders(),
      });

      if (allResponse.ok) {
        const allData = (await allResponse.json()) as {
          values?: Array<{ id: number; state: string }>;
        };
        if (allData.values && allData.values.length > 0) {
          const prNumber = allData.values[0].id;
          console.log(
            chalk.green(
              `✅ Found PR #${prNumber} for branch: ${branch} (${allData.values[0].state})`
            )
          );
          return prNumber.toString();
        }
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
   * Gets the component key using the same logic as SonarUrlBuilder
   * This ensures consistency across all API calls
   * @param config - Configuration object
   * @returns Component key
   */
  private getComponentKey(config: Config): string {
    const component = config.sonarProjectKey || config.repoName;
    return component;
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

    console.log(chalk.blue(`URL: ${url}`));

    if (logMessage) {
      console.log(chalk.blue(logMessage));
    }

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
    return await this.fetchIssues(
      config,
      { pullRequest: prKey },
      `Fetching issues from PR: ${prLink}`
    );
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

  /**
   * Builds the base URL for measures API endpoint
   * @param baseUrl - SonarQube base URL
   * @returns Normalized measures API URL
   */
  private buildMeasuresUrl(baseUrl: string): string {
    let url = baseUrl;
    if (!url.includes("/api/measures/component")) {
      url = url.replace(/\/api\/issues\/search$/, "").replace(/\/$/, "");
      url = `${url}/api/measures/component`;
    }
    return url;
  }

  /**
   * Builds the base URL for hotspots API endpoint
   * @param baseUrl - SonarQube base URL
   * @returns Normalized hotspots API URL
   */
  private buildHotspotsUrl(baseUrl: string): string {
    let url = baseUrl;
    if (!url.includes("/api/hotspots/search")) {
      url = url.replace(/\/api\/issues\/search$/, "").replace(/\/$/, "");
      url = `${url}/api/hotspots/search`;
    }
    return url;
  }

  /**
   * Fetches measures (duplications, coverage) for a PR or branch
   * @param config - Configuration object
   * @param options - URL building options (branch or pullRequest)
   * @returns Measures data
   */
  async fetchMeasures(
    config: Config,
    options: { branch?: string; pullRequest?: string }
  ): Promise<Record<string, unknown>> {
    const baseUrl = SonarUrlBuilder.normalizeUrl(config.sonarBaseUrl || this.sonarBaseUrlRaw);
    const measuresUrl = this.buildMeasuresUrl(baseUrl);

    // Use the same component key logic as the issues API for consistency
    const componentKey = this.getComponentKey(config);

    const params = new URLSearchParams({
      component: componentKey,
      metricKeys: [
        "duplicated_lines",
        "duplicated_lines_density",
        "duplicated_blocks",
        "duplicated_files",
        "new_duplicated_lines",
        "new_duplicated_lines_density",
        "new_duplicated_blocks",
        "coverage",
        "line_coverage",
        "branch_coverage",
        "new_coverage",
        "new_line_coverage",
        "new_branch_coverage",
        "uncovered_lines",
        "uncovered_conditions",
        "new_uncovered_lines",
        "new_uncovered_conditions",
      ].join(","),
    });

    if (options.pullRequest) {
      params.set("pullRequest", options.pullRequest);
    } else if (options.branch) {
      params.set("branch", options.branch);
    }

    const url = `${measuresUrl}?${params.toString()}`;

    const authHeaders = config.publicSonar ? {} : this.getSonarAuthHeaders(this.sonarToken);
    const response = await fetch(url, {
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return (await this.handleSonarResponse(response)) as Record<string, unknown>;
  }

  /**
   * Fetches security hotspots for a PR or branch
   * @param config - Configuration object
   * @param options - URL building options (branch or pullRequest)
   * @returns Security hotspots data
   */
  async fetchSecurityHotspots(
    config: Config,
    options: { branch?: string; pullRequest?: string }
  ): Promise<Record<string, unknown>> {
    const baseUrl = SonarUrlBuilder.normalizeUrl(config.sonarBaseUrl || this.sonarBaseUrlRaw);
    const hotspotsUrl = this.buildHotspotsUrl(baseUrl);

    // Use the same component key logic as the issues API for consistency
    const projectKey = this.getComponentKey(config);

    const params = new URLSearchParams({
      projectKey: projectKey,
      p: "1",
      ps: "100",
    });

    if (options.pullRequest) {
      params.set("pullRequest", options.pullRequest);
    } else if (options.branch) {
      params.set("branch", options.branch);
    }

    const url = `${hotspotsUrl}?${params.toString()}`;

    const authHeaders = config.publicSonar ? {} : this.getSonarAuthHeaders(this.sonarToken);
    const response = await fetch(url, {
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return (await this.handleSonarResponse(response)) as Record<string, unknown>;
  }
}
