/**
 * Bitbucket API tool for fetching repository information
 */

interface BitbucketRepoInfo {
  name: string;
  full_name: string;
  description?: string;
  created_on?: string;
  updated_on?: string;
  language?: string;
  size?: number;
  has_issues?: boolean;
  has_wiki?: boolean;
  is_private?: boolean;
  owner?: {
    username: string;
    display_name: string;
  };
  links?: {
    html?: { href: string };
    clone?: Array<{ href: string; name: string }>;
  };
}

interface BitbucketApiResponse extends BitbucketRepoInfo {
  [key: string]: unknown;
}

/**
 * Fetches repository metadata from Bitbucket API
 * @param owner - Repository owner/workspace name
 * @param repo - Repository name
 * @param token - Optional Bitbucket app password token
 * @param email - Optional Bitbucket email (required if token is provided)
 * @returns Repository metadata as JSON
 */
export const getRepoInfo = async (
  owner: string,
  repo: string,
  token?: string,
  email?: string
): Promise<BitbucketRepoInfo> => {
  const apiUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Add authentication if credentials provided
  if (token) {
    if (!email) {
      throw new Error("Email is required when token is provided");
    }
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    headers.Authorization = `Basic ${auth}`;
  }

  try {
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Bitbucket API error: ${response.status} ${response.statusText}. ${errorText.substring(0, 200)}`
      );
    }

    const data = (await response.json()) as BitbucketApiResponse;

    // Extract relevant repository information
    const repoInfo: BitbucketRepoInfo = {
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      created_on: data.created_on,
      updated_on: data.updated_on,
      language: data.language,
      size: data.size,
      has_issues: data.has_issues,
      has_wiki: data.has_wiki,
      is_private: data.is_private,
      owner: data.owner
        ? {
            username: data.owner.username,
            display_name: data.owner.display_name,
          }
        : undefined,
      links: data.links
        ? {
            html: data.links.html,
            clone: data.links.clone,
          }
        : undefined,
    };

    return repoInfo;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch Bitbucket repository info: ${errorMessage}`);
  }
};
