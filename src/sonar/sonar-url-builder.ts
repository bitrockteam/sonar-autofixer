/**
 * Minimal configuration needed for URL building
 */
interface UrlBuilderConfig {
  publicSonar?: boolean;
  sonarComponentKeys?: string;
  sonarOrganization?: string;
  sonarProjectKey?: string;
  gitOrganization?: string;
  repoName: string;
  timeZone?: string;
}

/**
 * Options for building SonarQube API URLs
 */
interface UrlBuildOptions {
  branch?: string;
  pullRequest?: string;
}

/**
 * Configuration for SonarCloud (public) vs SonarQube (private)
 */
interface SonarSetupConfig {
  isSonarCloud: boolean;
  componentKeys?: string;
  organization?: string;
  component?: string;
  timeZone?: string;
}

/**
 * SonarUrlBuilder - Centralized URL building for SonarQube API requests
 * Eliminates duplication across branch, PR link, and PR ID URL builders
 */
export class SonarUrlBuilder {
  private readonly baseUrl: string;
  private readonly setupConfig: SonarSetupConfig;

  /**
   * Creates a new SonarUrlBuilder instance
   * @param baseUrl - Normalized SonarQube base URL
   * @param config - Configuration object
   */
  constructor(baseUrl: string, config: UrlBuilderConfig) {
    this.baseUrl = baseUrl;

    const isSonarCloud =
      Boolean(config.publicSonar) &&
      Boolean(config.sonarComponentKeys) &&
      Boolean(config.sonarOrganization);

    // Determine component value - prefer project key, fallback to repo name
    const component = config.sonarProjectKey || config.repoName;

    this.setupConfig = {
      isSonarCloud,
      componentKeys: config.sonarComponentKeys,
      organization: config.sonarOrganization,
      component: component,
      timeZone: config.timeZone,
    };
  }

  /**
   * Builds the base query parameters common to all SonarQube requests
   * @returns Base URLSearchParams with common parameters
   */
  private buildBaseParams(): URLSearchParams {
    const params = new URLSearchParams({
      s: "FILE_LINE",
      ps: "100",
      additionalFields: "_all",
    });

    if (this.setupConfig.isSonarCloud) {
      params.set("issueStatuses", "OPEN,CONFIRMED");
      params.set("facets", "impactSoftwareQualities,impactSeverities");
      if (this.setupConfig.componentKeys) {
        params.set("componentKeys", this.setupConfig.componentKeys);
      }
      if (this.setupConfig.organization) {
        params.set("organization", this.setupConfig.organization);
      }
    } else {
      // SonarQube private instance
      params.set("issueStatuses", "CONFIRMED,OPEN");
      params.set(
        "facets",
        "cleanCodeAttributeCategories,impactSoftwareQualities,severities,types,impactSeverities,codeVariants"
      );
      if (this.setupConfig.component) {
        params.set("components", this.setupConfig.component);
      }
      if (this.setupConfig.timeZone) {
        params.set("timeZone", this.setupConfig.timeZone);
      }
    }

    return params;
  }

  /**
   * Builds a URL for fetching SonarQube issues
   * @param options - Options for branch or pullRequest
   * @returns Complete URL with query parameters
   */
  buildUrl(options: UrlBuildOptions): string {
    const params = this.buildBaseParams();

    if (options.branch) {
      params.set("branch", options.branch);
    }

    if (options.pullRequest) {
      params.set("pullRequest", options.pullRequest);
    }

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Normalizes a SonarQube base URL to the API endpoint
   * @param baseUrl - Raw base URL
   * @returns Normalized API URL
   */
  static normalizeUrl(baseUrl: string): string {
    let url = baseUrl;
    if (!url.includes("/api/issues/search")) {
      url = url.replace(/\/project\/issues[^/]*$/, "").replace(/\/$/, "");
      url = url.replace(/\/api\/issues$/, "");
      url = `${url}/api/issues/search`;
    }
    return url;
  }
}
