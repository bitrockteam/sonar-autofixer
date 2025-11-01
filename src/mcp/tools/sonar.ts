/**
 * SonarQube API tool for fetching quality gate status
 */

interface QualityGateCondition {
  status?: string;
  metricKey?: string;
  comparator?: string;
  errorThreshold?: string;
  actualValue?: string;
}

interface QualityGateProjectStatus {
  projectStatus?: {
    status?: string;
    conditions?: QualityGateCondition[];
  };
}

interface QualityGateStatusResult {
  status: string;
  conditions?: QualityGateCondition[];
  projectKey: string;
  gateName?: string;
}

/**
 * Normalizes SonarQube base URL
 * @param baseUrl - Base URL (may include /api path)
 * @returns Normalized base URL without /api
 */
const normalizeBaseUrl = (baseUrl: string): string => {
  let url = baseUrl.trim();
  // Remove trailing slashes
  url = url.replace(/\/+$/, "");
  // Remove /api if present
  url = url.replace(/\/api$/, "");
  return url;
};

/**
 * Fetches quality gate status from SonarQube API
 * @param projectKey - SonarQube project key
 * @param sonarToken - Optional SonarQube authentication token
 * @param sonarBaseUrl - Optional SonarQube base URL (defaults to https://sonarcloud.io/api)
 * @returns Quality gate status with conditions
 */
export const getQualityGateStatus = async (
  projectKey: string,
  sonarToken?: string,
  sonarBaseUrl?: string
): Promise<QualityGateStatusResult> => {
  const baseUrl = sonarBaseUrl ? normalizeBaseUrl(sonarBaseUrl) : "https://sonarcloud.io";
  const apiBase = `${baseUrl}/api`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Add authentication if token provided
  if (sonarToken) {
    const tokenString = `${sonarToken}:`;
    const basicAuth = `Basic ${Buffer.from(tokenString).toString("base64")}`;
    headers.Authorization = basicAuth;
  }

  try {
    // Primary: Get quality gate project status
    const statusUrl = `${apiBase}/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`;
    const statusResponse = await fetch(statusUrl, { headers });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(
        `SonarQube API error: ${statusResponse.status} ${statusResponse.statusText}. ${errorText.substring(0, 200)}`
      );
    }

    const statusData = (await statusResponse.json()) as QualityGateProjectStatus;
    const projectStatus = statusData.projectStatus;

    if (!projectStatus) {
      throw new Error("Invalid response from SonarQube API: missing projectStatus");
    }

    const result: QualityGateStatusResult = {
      status: projectStatus.status || "UNKNOWN",
      projectKey,
      conditions: projectStatus.conditions,
    };

    // Secondary: Try to get quality gate details (optional)
    try {
      // Get the quality gate name from project measures or use default
      // For now, we'll skip the show endpoint as it requires the gate ID
      // which we'd need to fetch from project settings
      // This is optional per the requirements
    } catch {
      // Ignore errors for optional gate details
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch SonarQube quality gate status: ${errorMessage}`);
  }
};
