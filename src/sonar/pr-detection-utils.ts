import chalk from "chalk";

/**
 * Regular expression pattern for extracting PR numbers from branch names
 * Matches patterns like:
 * - pr/123, PR/123, pull/123, PULL/123
 * - feat/feature-123, feature/123, fix/123, bugfix/123
 */
const PR_NUMBER_REGEX =
  /(?:pr\/|PR\/|pull\/|PULL\/)(\d+)|(?:feat\/|feature\/|fix\/|bugfix\/).*?(\d+)/i;

/**
 * Extracts PR number from a branch name using regex pattern matching
 * @param branch - Branch name to extract PR number from
 * @returns PR number as string if found, null otherwise
 */
export const extractPrNumberFromBranch = (branch: string): string | null => {
  const match = PR_NUMBER_REGEX.exec(branch);
  if (match) {
    const prNumber = match[1] || match[2];
    if (prNumber) {
      console.log(chalk.green(`✅ Extracted PR #${prNumber} from branch name: ${branch}`));
      return prNumber;
    }
  }
  return null;
};

/**
 * Formats a GitHub PR API URL for fetching PRs by branch
 * @param baseUrl - GitHub API base URL
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param state - PR state (open, closed, all)
 * @returns Complete GitHub API URL
 */
export const buildGitHubPrApiUrl = (
  baseUrl: string,
  owner: string,
  repo: string,
  branch: string,
  state: "open" | "closed" | "all" = "open"
): string => {
  return `${baseUrl}/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=${state}`;
};

/**
 * Formats a Bitbucket PR API URL for fetching PRs by branch
 * @param baseUrl - Bitbucket API base URL
 * @param organization - Organization/workspace name
 * @param repoName - Repository name
 * @param branch - Branch name
 * @returns Complete Bitbucket API URL
 */
export const buildBitbucketPrApiUrl = (
  baseUrl: string,
  organization: string,
  repoName: string,
  branch: string
): string => {
  return `${baseUrl}/${organization}/${repoName}/pullrequests?q=source.branch.name="${branch}"`;
};
