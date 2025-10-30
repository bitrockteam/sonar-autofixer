# Sonar Autofixer

CLI utility for fetching SonarQube issues and running local SonarQube scans. Automatically detects PR IDs from branches and fetches SonarQube issues for code quality analysis. Includes AI editor integration for automated issue fixing.

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
npm install @bitrockteam/sonar-autofixer
```

Or install globally:

```bash
npm install -g @bitrockteam/sonar-autofixer
```

## Quick Start

### 1. Initialize Configuration

Run the interactive setup to configure your project:

```bash
npx @bitrockteam/sonar-autofixer init
```

This will:

- Create `.sonar/autofixer.config.json` with your project settings
- Add npm scripts to your `package.json`
- Create AI editor rules for automated issue fixing (Cursor, VSCode, Windsurf)

### 2. Set Up Environment Variables

Create a `.env` file in your project root:

```env
# GitHub Configuration
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name

# SonarQube/SonarCloud Configuration
SONAR_TOKEN=your-sonar-token
SONAR_ORGANIZATION=your-organization
SONAR_COMPONENT_KEYS=your-project-key
SONAR_BASE_URL=https://sonarcloud.io/api/issues/search
```

## Usage

### Commands

#### Fetch SonarQube Issues

```bash
# Fetch issues for current branch (auto-detects PR)
npx @bitrockteam/sonar-autofixer fetch

# Fetch issues for a specific branch
npx @bitrockteam/sonar-autofixer fetch my-branch

# Fetch issues from a SonarQube PR link
npx @bitrockteam/sonar-autofixer fetch my-branch https://sonarcloud.io/project/issues?id=project&pullRequest=PR_KEY
```

#### Run Local SonarQube Scan

```bash
# Run local SonarQube scan
npx @bitrockteam/sonar-autofixer scan
```

#### Initialize Configuration

```bash
# Interactive setup
npx @bitrockteam/sonar-autofixer init
```

#### Check for Updates

```bash
# Check for updates and get latest version info
npx @bitrockteam/sonar-autofixer update
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

- **Automatic PR Detection**: Automatically detects PR IDs from your current git branch using GitHub API
- **Fallback Support**: Falls back to branch-based fetching if PR detection fails
- **PR Link Support**: Directly fetch issues using a SonarQube PR link
- **Local Scanning**: Run SonarQube scans locally and save results
- **AI Editor Integration**: Creates rules for Cursor, VSCode, Windsurf for automated issue fixing
- **Issue Summary**: Displays a summary of issues by severity after fetching
- **Configuration Management**: Interactive setup for easy configuration
- **Update Checking**: Built-in command to check for updates and get latest version info

## Updating the CLI

Since this CLI is designed to be used with `npx`, updating is simple:

### Always Get the Latest Version

```bash
# Use @latest to always get the most recent version
npx @bitrockteam/sonar-autofixer@latest <command>
```

### Check for Updates

```bash
# Check current version and get update instructions
npx @bitrockteam/sonar-autofixer update
```

### Update Your npm Scripts

If you've set up npm scripts in your `package.json`, update them to use `@latest`:

```json
{
  "scripts": {
    "sonar:fetch": "npx @bitrockteam/sonar-autofixer@latest fetch",
    "sonar:scan": "npx @bitrockteam/sonar-autofixer@latest scan"
  }
}
```

## How It Works

### Fetch Command

1. Detects the current git branch or uses provided branch name
2. Attempts to find associated PR using GitHub API or branch name pattern matching
3. Fetches SonarQube issues for the PR or branch
4. Saves issues to `.sonar/issues.json`
5. Displays a summary of fetched issues

### Scan Command

1. Validates SonarQube token and configuration
2. Runs local SonarQube scanner
3. Saves results to `.sonar/scanner-report.json`
4. Provides detailed scan output

### Init Command

1. Prompts for project configuration (repo name, git provider, etc.)
2. Creates configuration file
3. Updates package.json with npm scripts
4. Creates AI editor rules based on your editor choice

## Output Files

- `.sonar/issues.json` - Fetched SonarQube issues in JSON format
- `.sonar/scanner-report.json` - Local scan results
- `.sonar/autofixer.config.json` - Project configuration
- `.cursor/rules/sonar-issue-fix.mdc` - Cursor AI rules (if selected)
- `.vscode/sonar-issue-fix.md` - VSCode rules (if selected)
- `.windsurf/rules/sonar-issue-fix.mdc` - Windsurf rules (if selected)

## AI Editor Integration

The tool creates specific rules for your chosen AI editor to help with automated SonarQube issue fixing:

- **Cursor**: Creates `.cursor/rules/sonar-issue-fix.mdc`
- **VSCode with Copilot**: Creates `.vscode/sonar-issue-fix.md`
- **Windsurf**: Creates `.windsurf/rules/sonar-issue-fix.mdc`

These rules provide patterns and priorities for fixing common SonarQube issues.

## Requirements

- Node.js (v18 or higher)
- Git repository
- GitHub API token with appropriate permissions
- SonarQube/SonarCloud access
- SonarQube Scanner (for local scans): `npm install -g @sonar/scan`

## License

ISC
