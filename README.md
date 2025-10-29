# Sonar Autofixer

CLI utility for fetching SonarQube issues and integrating with Bitbucket/GitHub PR workflows. Automatically detects PR IDs from branches and fetches SonarQube issues for code quality analysis.

## Installation

Since this package is published to GitHub Packages, you'll need to authenticate to install it.

### 1. Authenticate to GitHub Packages

Create or edit your `~/.npmrc` file to include:

```
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Or use npm login:

```bash
npm login --scope=@davide97g --auth-type=legacy --registry=https://npm.pkg.github.com
```

### 2. Configure project .npmrc

Add the following to your project's `.npmrc` file (or create one):

```
@davide97g:registry=https://npm.pkg.github.com
```

### 3. Install the package

```bash
npm install @davide97g/sonar-autofixer
```

Or install globally:

```bash
npm install -g @davide97g/sonar-autofixer
```

## Usage

### As a CLI tool

After installation, you can use the `sonar-fetch` command:

```bash
# Fetch issues for current branch (auto-detects PR)
sonar-fetch

# Fetch issues for a specific branch
sonar-fetch my-branch

# Fetch issues from a SonarQube PR link
sonar-fetch my-branch https://sonarqube.example.com/project/issues?id=project&pullRequest=PR_KEY
```

### As an npm script

```bash
npm run sonar:fetch [branch] [sonar-pr-link]
```

## Configuration

Create a `.env` file in your project root with the following variables:

```env
BITBUCKET_EMAIL=your-email@example.com
BITBUCKET_API_TOKEN=your-api-token
SONAR_BASE_URL=https://your-sonarqube.com/project/issues
BITBUCKET_BASE_URL=https://api.bitbucket.org/2.0/repositories/your-org/your-repo
```

## Features

- **Automatic PR Detection**: Automatically detects PR IDs from your current git branch using Bitbucket/GitHub API
- **Fallback Support**: Falls back to branch-based fetching if PR detection fails
- **PR Link Support**: Directly fetch issues using a SonarQube PR link
- **Issue Summary**: Displays a summary of issues by severity after fetching

## How It Works

1. Detects the current git branch or uses provided branch name
2. Attempts to find associated PR using Bitbucket API or branch name pattern matching
3. Fetches SonarQube issues for the PR or branch
4. Saves issues to `.sonar/issues.json`
5. Displays a summary of fetched issues

## Output

The script saves fetched issues to `.sonar/issues.json` in your project root. This file contains all SonarQube issues in JSON format, ready for further processing or analysis.

## Requirements

- Node.js (v14 or higher)
- Git repository
- Bitbucket/GitHub API token with appropriate permissions
- SonarQube access

## License

ISC
