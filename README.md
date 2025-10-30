# Sonar Autofixer

CLI utility for fetching SonarQube issues and running local SonarQube scans. Automatically detects PR IDs from branches and fetches SonarQube issues for code quality analysis. Includes AI editor integration for automated issue fixing. Supports GitHub and Bitbucket.

## Installation

Since this package is published to GitHub Packages, you'll need to authenticate to install it.

### 1. Authenticate to GitHub Packages

Create or edit your `~/.npmrc` file to include:

```
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Or use npm login:

```bash
npm login --scope=@bitrockteam --auth-type=legacy --registry=https://npm.pkg.github.com
```

### 2. Configure project .npmrc

Add the following to your project's `.npmrc` file (or create one):

```
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
GIT_EMAIL=your-email@example.com        # Required for Bitbucket PR detection; optional for GitHub

# GitHub (only if using GitHub)
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repo-name
GITHUB_API_URL=https://api.github.com   # Optional, defaults to https://api.github.com

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

#### Run Local SonarQube Scan

```bash
# Run local SonarQube scan
npx @bitrockteam/sonarflow scan
```

- Requires `@sonar/scan` installed globally.
- Results are saved to `.sonar/scanner-report.json`.
- If `publicSonar` is true in `.sonarflowrc.json`, `SONAR_TOKEN` is not required.

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
npm run sonar:fetch

# Run local scan
npm run sonar:scan
```

## Features

- **Automatic PR Detection**: Detects PR IDs from your current git branch using GitHub or Bitbucket APIs
- **Fallback Support**: Falls back to branch-based extraction if PR detection fails
- **PR Link Support**: Fetch issues directly using a SonarQube PR link
- **Local Scanning**: Run SonarQube scans locally and save results
- **AI Editor Integration**: Creates rules for Cursor, VSCode, Windsurf for automated issue fixing
- **Custom Icon Theme**: Installs a local theme under `.vscode/icon-theme/` and sets `workbench.iconTheme` so `.sonarflowrc.json` is visually distinguished in your workspace
- **Issue Summary**: Displays a summary of issues by severity after fetching
- **Configuration Management**: Interactive setup for easy configuration
- **Update Checking**: Built-in command to check for updates and get latest version info

## Updating the CLI

Since this CLI is designed to be used with `npx`, updating is simple:

### Always Get the Latest Version

```bash
# Use @latest to always get the most recent version
npx @bitrockteam/sonarflow@latest <command>
```

### Check for Updates

```bash
# Check current version and get update instructions
npx @bitrockteam/sonarflow update
```

### Update Your npm Scripts

If you've set up npm scripts in your `package.json`, update them to use `@latest`:

```json
{
  "scripts": {
    "sonar:fetch": "npx @bitrockteam/sonarflow@latest fetch",
    "sonar:scan": "npx @bitrockteam/sonarflow@latest scan"
  }
}
```

## How It Works

### Fetch Command

1. Detects the current git branch or uses provided branch name
2. Attempts to find associated PR using GitHub or Bitbucket API, or branch name pattern matching
3. Fetches SonarQube issues for the PR or branch
4. Saves issues to `.sonar/issues.json`
5. Displays a summary of fetched issues

### Scan Command

1. Reads `.sonarflowrc.json` to determine if `publicSonar` is enabled
2. Validates `SONAR_TOKEN` when required (private Sonar)
3. Runs local SonarQube scanner
4. Saves results to `.sonar/scanner-report.json`
5. Provides detailed scan output

### Init Command

1. Prompts for project configuration (repo name, git provider, visibility, etc.)
2. Creates configuration file `.sonarflowrc.json`
3. Updates `package.json` with npm scripts
4. Creates AI editor rules based on your editor choice

## Output Files

- `.sonar/issues.json` - Fetched SonarQube issues in JSON format
- `.sonar/scanner-report.json` - Local scan results
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
- SonarQube Scanner (for local scans): `npm install -g @sonar/scan`

## License

ISC
