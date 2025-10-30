import dotenv from "dotenv";
import { execSync } from "node:child_process";

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
  sonarBaseUrl?: string;
  publicSonar?: boolean;
  gitProvider?: string;
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
  private readonly sonarComponentKeys: string | undefined;
  private readonly sonarOrganization: string | undefined;

  constructor() {
    // GitHub configuration
    this.gitToken = process.env.GITHUB_TOKEN;
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

    this.bitbucketBaseUrl = process.env.BITBUCKET_BASE_URL;

    // SonarQube configuration
    this.sonarToken = process.env.SONAR_TOKEN;
    this.sonarBaseUrlRaw = process.env.SONAR_BASE_URL || "https://sonarcloud.io/api/issues/search";
    this.sonarComponentKeys = process.env.SONAR_COMPONENT_KEYS;
    this.sonarOrganization = process.env.SONAR_ORGANIZATION;
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
   * Normalizes SonarQube base URL to API endpoint
   * @param baseUrl - Raw base URL
   * @returns Normalized API URL
   */
  normalizeSonarUrl(baseUrl: string): string {
    let url = baseUrl;
    if (!url.includes("/api/issues/search")) {
      url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
      url = url.replace(/\/api\/issues$/, "");
      url = `${url}/api/issues/search`;
    }
    return url;
  }

  /**
   * Detects GitHub PR ID from branch name
   * @param branch - Branch name
   * @returns PR ID if found, null otherwise
   */
  async detectGitHubPrId(branch: string): Promise<string | null> {
    try {
      if (!this.gitToken || !this.githubOwner || !this.githubRepo) {
        console.log("⚠️  GitHub configuration missing, skipping PR detection");
        return null;
      }

      // Try to get PR number from GitHub API using the branch name
      const githubApiUrl = `${this.githubBaseUrl}/repos/${this.githubOwner}/${this.githubRepo}/pulls?head=${this.githubOwner}:${branch}&state=open`;
      console.log(`🔍 Checking for PR associated with branch: ${branch}`);

      const response = await fetch(githubApiUrl, {
        headers: {
          Authorization: `token ${this.gitToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Array<{ number: number }>;
        if (Array.isArray(data) && data.length > 0) {
          const prNumber = data[0].number;
          console.log(`✅ Found PR #${prNumber} for branch: ${branch}`);
          return prNumber.toString();
        }
      }

      // Also check closed PRs in case the branch is merged
      const closedPrUrl = `${this.githubBaseUrl}/repos/${this.githubOwner}/${this.githubRepo}/pulls?head=${this.githubOwner}:${branch}&state=all`;
      const closedResponse = await fetch(closedPrUrl, {
        headers: {
          Authorization: `token ${this.gitToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (closedResponse.ok) {
        const closedData = (await closedResponse.json()) as Array<{
          number: number;
        }>;
        if (Array.isArray(closedData) && closedData.length > 0) {
          const prNumber = closedData[0].number;
          console.log(`✅ Found PR #${prNumber} for branch: ${branch} (closed/merged)`);
          return prNumber.toString();
        }
      }

      // Fallback: try to extract PR number from branch name
      const prNumberRegex =
        /(?:pr\/|PR\/|pull\/|PULL\/)(\d+)|(?:feat\/|feature\/|fix\/|bugfix\/).*?(\d+)/i;
      const prNumberMatch = prNumberRegex.exec(branch);
      if (prNumberMatch) {
        const prNumber = prNumberMatch[1] || prNumberMatch[2];
        console.log(`✅ Extracted PR #${prNumber} from branch name: ${branch}`);
        return prNumber || null;
      }

      console.log(`⚠️  No PR found for branch: ${branch}`);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⚠️  Could not detect GitHub PR ID: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Detects Bitbucket PR ID from branch name
   * @param branch - Branch name
   * @returns PR ID if found, null otherwise
   */
  async detectBitbucketPrId(branch: string): Promise<string | null> {
    try {
      if (!this.gitEmail || !this.gitToken || !this.bitbucketBaseUrl) {
        console.log("⚠️  Bitbucket configuration missing, skipping PR detection");
        return null;
      }

      // Try to get PR number from Bitbucket API using the branch name
      const bitbucketApiUrl = `${this.bitbucketBaseUrl}/pullrequests?q=source.branch.name="${branch}"`;
      console.log(`🔍 Checking for PR associated with branch: ${branch}`);

      const response = await fetch(bitbucketApiUrl, {
        headers: this.getBitbucketAuthHeaders(),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          values?: Array<{ id: number }>;
        };
        if (data.values && data.values.length > 0) {
          const prNumber = data.values[0].id;
          console.log(`✅ Found PR #${prNumber} for branch: ${branch}`);
          return prNumber.toString();
        }
      }

      // Fallback: try to extract PR number from branch name
      const prNumberRegex =
        /(?:pr\/|PR\/|pull\/|PULL\/)(\d+)|(?:feat\/|feature\/|fix\/|bugfix\/).*?(\d+)/i;
      const prNumberMatch = prNumberRegex.exec(branch);
      if (prNumberMatch) {
        const prNumber = prNumberMatch[1] || prNumberMatch[2];
        console.log(`✅ Extracted PR #${prNumber} from branch name: ${branch}`);
        return prNumber || null;
      }

      console.log(`⚠️  No PR found for branch: ${branch}`);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⚠️  Could not detect Bitbucket PR ID: ${errorMessage}`);
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
      console.error(`Unexpected content type: ${contentType}`);
      console.error(`Response preview: ${errorText.substring(0, 500)}`);
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
   * Builds URL for fetching issues by branch
   * @param branch - Branch name
   * @param config - Configuration object
   * @returns URL for fetching issues
   */
  buildUrlForBranch(branch: string, config: Config): string {
    const sonarBaseUrl = this.normalizeSonarUrl(config.sonarBaseUrl || this.sonarBaseUrlRaw);

    // Check if this is a SonarCloud setup (has organization and componentKeys)
    if (config.publicSonar && this.sonarComponentKeys && this.sonarOrganization) {
      const params = new URLSearchParams({
        s: "FILE_LINE",
        issueStatuses: "OPEN,CONFIRMED",
        ps: "100",
        facets: "impactSoftwareQualities,impactSeverities",
        componentKeys: this.sonarComponentKeys,
        organization: this.sonarOrganization,
        branch: branch,
        additionalFields: "_all",
      });
      return `${sonarBaseUrl}?${params.toString()}`;
    }
    // SonarQube setup (private instance)
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
  }

  /**
   * Builds URL for fetching issues by PR link
   * @param prLink - SonarQube PR link
   * @param config - Configuration object
   * @returns URL for fetching issues
   */
  buildUrlForPr(prLink: string, config: Config): string {
    const sonarBaseUrl = this.normalizeSonarUrl(config.sonarBaseUrl || this.sonarBaseUrlRaw);

    // Extract PR key from the SonarQube PR link
    const prKeyMatch = prLink.match(/pullRequest=([^&]+)/);
    if (!prKeyMatch) {
      throw new Error(
        "Invalid SonarQube PR link format. Expected format: https://sonarcloud.io/project/issues?id=project&pullRequest=PR_KEY"
      );
    }

    const prKey = prKeyMatch[1];

    // Check if this is a SonarCloud setup
    if (config.publicSonar && this.sonarComponentKeys && this.sonarOrganization) {
      const params = new URLSearchParams({
        s: "FILE_LINE",
        issueStatuses: "OPEN,CONFIRMED",
        ps: "100",
        facets: "impactSoftwareQualities,impactSeverities",
        componentKeys: this.sonarComponentKeys,
        organization: this.sonarOrganization,
        pullRequest: prKey,
        additionalFields: "_all",
      });
      return `${sonarBaseUrl}?${params.toString()}`;
    }
    // SonarQube setup (private instance)
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
  }

  /**
   * Builds URL for fetching issues by PR ID
   * @param prId - PR ID
   * @param config - Configuration object
   * @returns URL for fetching issues
   */
  buildUrlForPrId(prId: string, config: Config): string {
    const sonarBaseUrl = this.normalizeSonarUrl(config.sonarBaseUrl || this.sonarBaseUrlRaw);

    // Check if this is a SonarCloud setup
    if (config.publicSonar && this.sonarComponentKeys && this.sonarOrganization) {
      const params = new URLSearchParams({
        s: "FILE_LINE",
        issueStatuses: "OPEN,CONFIRMED",
        ps: "100",
        facets: "impactSoftwareQualities,impactSeverities",
        componentKeys: this.sonarComponentKeys,
        organization: this.sonarOrganization,
        pullRequest: prId,
        additionalFields: "_all",
      });
      return `${sonarBaseUrl}?${params.toString()}`;
    }
    // SonarQube setup (private instance)
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
  }

  /**
   * Fetches issues for a branch
   * @param branch - Branch name
   * @param config - Configuration object
   * @returns Issues data
   */
  async fetchIssuesForBranch(branch: string, config: Config): Promise<SonarResponse> {
    const url = this.buildUrlForBranch(branch, config);
    console.log(`Fetching issues from: ${url.replace(/sonarToken=[^&]+/, "sonarToken=***")}`);

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
   * Fetches issues for a PR link
   * @param prLink - SonarQube PR link
   * @param config - Configuration object
   * @returns Issues data
   */
  async fetchIssuesForPr(prLink: string, config: Config): Promise<SonarResponse> {
    const url = this.buildUrlForPr(prLink, config);
    console.log(`Fetching issues from PR: ${url.replace(/sonarToken=[^&]+/, "sonarToken=***")}`);

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
   * Fetches issues for a PR ID
   * @param prId - PR ID
   * @param config - Configuration object
   * @returns Issues data
   */
  async fetchIssuesForPrId(prId: string, config: Config): Promise<SonarResponse> {
    const url = this.buildUrlForPrId(prId, config);
    console.log(`Fetching issues from PR ID: ${prId}`);
    console.log(`URL: ${url.replace(/sonarToken=[^&]+/, "sonarToken=***")}`);

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
}
