# Sonarflow

<p align="center">
  <img src="./public/logo.svg" alt="Sonarflow logo" width="128" />
</p>

CLI utility for fetching SonarQube issues and running local SonarQube scans. Automatically detects PR IDs from branches and fetches SonarQube issues for code quality analysis. Includes AI editor integration for automated issue fixing. Supports GitHub and Bitbucket.

## Installation

Since this package is published to GitHub Packages, you'll need to authenticate to install it.

### 1. Authenticate to GitHub Packages

Create or edit your `~/.npmrc` file to include:

```bash
# .npmrc
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Or use npm login:

```bash
npm login --scope=@bitrockteam --auth-type=legacy --registry=https://npm.pkg.github.com
```

### 2. Configure project .npmrc

Add the following to your project's `.npmrc` file (or create one):

```bash
# .npmrc
@bitrockteam:registry=https://npm.pkg.github.com
```

### 3. Install the package

```bash
npm install @bitrockteam/sonarflow
```

Or install globally:

```bash
npm install -g @bitrockteam/sonarflow
```

## Quick Start

### 1. Initialize Configuration

Run the interactive setup to configure your project:

```bash
npx @bitrockteam/sonarflow init
```

This will:

- Create `.sonarflowrc.json` with your project settings (repo, visibility, publicSonar, output path, preferred AI editor)
- Add npm scripts to your `package.json`
- Create AI editor rules for automated issue fixing (Cursor, VSCode, Windsurf)
- Install a workspace icon theme so `.sonarflowrc.json` uses a custom icon in VS Code/Cursor

### 2. Set Up Environment Variables

Create a `.env` file in your project root:

```env
# Git Provider (shared)
GIT_TOKEN=your-token                    # GitHub or Bitbucket token (required for PR detection)
GIT_EMAIL=your-email@example.com        # Required for Bitbucket PR detection; optional for GitHub or if you already have configured `git config user.email`

# GitHub (only if using GitHub)
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repo-name

# Bitbucket (only if using Bitbucket)
BITBUCKET_BASE_URL=https://api.bitbucket.org/2.0/repositories  # Optional, has sane default

# SonarQube/SonarCloud Configuration
SONAR_TOKEN=your-sonar-token            # Required for private Sonar; not needed if publicSonar=true
SONAR_ORGANIZATION=your-organization    # For SonarCloud
SONAR_COMPONENT_KEYS=your-project-key   # For SonarCloud fetch
SONAR_BASE_URL=https://sonarcloud.io/api/issues/search  # Optional override
SONAR_PROJECT_KEY=your-project-key      # Used by local scanner command
```

Notes:

- If `.sonarflowrc.json` has `"publicSonar": true`, the scanner won’t require `SONAR_TOKEN`.
- For Bitbucket PR detection, both `GIT_EMAIL` and `GIT_TOKEN` are required.

## Access Tokens (How to Create + Required Scopes)

To use this CLI you’ll need tokens for your Git provider and, when scanning private projects, for Sonar.

- **GitHub Personal Access Token**
  - **What you need**: Classic token with minimal scopes
  - **Scopes**:
    - `read:packages` (required to install from GitHub Packages)
    - `repo` (required if your repository is private to detect PRs)
  - **Guide**: [Create a GitHub personal access token (classic)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

- **Bitbucket App Password**
  - **What you need**: App password for Bitbucket Cloud
  - **Permissions** (minimum recommended):
    - Repositories: `Read`
    - Pull requests: `Read`
    - Account: `Read` (to resolve email/user when needed)
  - You must also set `GIT_EMAIL` to your Bitbucket email in `.env`.
  - **Guide**: [Bitbucket Cloud — App passwords](https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/)

- **Sonar Token**
  - Required only when fetching from private SonarQube/SonarCloud projects or when `.sonarflowrc.json` does not set `"publicSonar": true`.
  - **Scope**: Standard user token (no special permissions typically needed beyond access to the project)
  - **Guides**:
    - SonarCloud: [Generating and using tokens](https://docs.sonarcloud.io/advanced-setup/user-accounts/generating-and-using-tokens/)
    - SonarQube: [Generate and use tokens](https://docs.sonarsource.com/sonarqube/latest/user-guide/user-account/generate-and-use-tokens/)

After creating tokens, place them in your `.env` as shown in the "Set Up Environment Variables" section above.

## Usage

### Commands

#### Fetch SonarQube Issues

```bash
# Fetch issues for current branch (auto-detects PR on GitHub/Bitbucket)
npx @bitrockteam/sonarflow fetch

# Fetch issues for a specific branch
npx @bitrockteam/sonarflow fetch my-branch

# Fetch issues from a SonarQube PR link
npx @bitrockteam/sonarflow fetch my-branch https://sonarcloud.io/project/issues?id=project&pullRequest=PR_KEY
```

- Auto PR detection tries provider API first (GitHub or Bitbucket), then falls back to extracting from branch naming patterns.
- Issues are saved to `.sonar/issues.json`.

#### Initialize Configuration

```bash
# Interactive setup
npx @bitrockteam/sonarflow init
```

#### Check for Updates

```bash
# Check for updates and get latest version info
npx @bitrockteam/sonarflow update
```

### As npm Scripts

After initialization, you can use the added npm scripts:

```bash
# Fetch issues
sonar:fetch
```

## Features

- **Automatic PR Detection**: Detects PR IDs from your current git branch using GitHub or Bitbucket APIs
- **Fallback Support**: Falls back to branch-based extraction if PR detection fails
- **PR Link Support**: Fetch issues directly using a SonarQube PR link
- **AI Editor Integration**: Creates rules for Cursor, VSCode, Windsurf for automated issue fixing
- **Custom Icon Theme**: Installs a local theme under `.vscode/icon-theme/` and sets `workbench.iconTheme` so `.sonarflowrc.json` is visually distinguished in your workspace
- **Issue Summary**: Displays a summary of issues by severity after fetching
- **Configuration Management**: Interactive setup for easy configuration
- **Update Checking**: Built-in command to check for updates and get latest version info

## Tech Stack

- **Language**: TypeScript (compiled to Node.js)
- **Runtime**: Node.js (>= 22.21.0)
- **Package Manager/Registry**: npm + GitHub Packages
- **Build/Bundle**: TypeScript `tsc`
- **TypeScript Native Reference**: [microsoft/typescript-go](https://github.com/microsoft/typescript-go) (TypeScript 7 native preview)
- **Lint/Format**: Biome
- **Lockfile**: Bun (for development reproducibility)
- **APIs**: SonarQube/SonarCloud REST APIs, GitHub REST API, Bitbucket Cloud API
- **Editor Integrations**: Cursor, VSCode (Copilot), Windsurf rule templates

## Updating the CLI

Since this CLI is designed to be used with `npx`, updating is simple:

### Always Get the Latest Version

```bash
# Use @latest to always get the most recent version
npx @bitrockteam/sonarflow@latest <command>
```

## How It Works

### Fetch Command

1. Detects the current git branch or uses provided branch name
2. Attempts to find associated PR using GitHub or Bitbucket API, or branch name pattern matching
3. Fetches SonarQube issues for the PR or branch
4. Saves issues to `.sonar/issues.json`
5. Displays a summary of fetched issues


### Init Command

1. Prompts for project configuration (repo name, git provider, visibility, etc.)
2. Creates configuration file `.sonarflowrc.json`
3. Updates `package.json` with npm scripts
4. Creates AI editor rules based on your editor choice

## Output Files

- `.sonar/issues.json` - Fetched SonarQube issues in JSON format
- `.sonarflowrc.json` - Project configuration
- `.cursor/rules/sonar-issue-fix.mdc` - Cursor AI rules (if selected)
- `.vscode/sonar-issue-fix.md` - VSCode rules (if selected)
- `.windsurf/rules/sonar-issue-fix.mdc` - Windsurf rules (if selected)
- `.rules/sonar-issue-fix.md` - Generic rules (if selected "other")

## AI Editor Integration

The tool creates specific rules for your chosen AI editor to help with automated SonarQube issue fixing:

- **Cursor**: Creates `.cursor/rules/sonar-issue-fix.mdc`
- **VSCode with Copilot**: Creates `.vscode/sonar-issue-fix.md`
- **Windsurf**: Creates `.windsurf/rules/sonar-issue-fix.mdc`
- **Other**: Creates `.rules/sonar-issue-fix.md`

These rules provide patterns and priorities for fixing common SonarQube issues.

## Requirements

- Node.js (>= 22.21.0)
- Git repository
- Git provider token (`GIT_TOKEN`) and, for Bitbucket, `GIT_EMAIL`
- SonarQube/SonarCloud access

## License

ISC
