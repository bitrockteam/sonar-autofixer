# Automated Release Setup

## Overview

This project uses **fully automated versioning and releases** via GitHub Actions. No manual intervention required!

## How It Works

### Branch Strategy

```
Feature Branch → develop → main
                  ↓          ↓
                Beta      Production
```

### Workflow Details

#### 1. Beta Releases (`develop` branch)

**Trigger:** Any push to `develop` branch (excluding documentation-only changes)

**What happens:**
- ✅ Checks for version-bump commits (`feat:`, `fix:`, `perf:`, `refactor:`, `BREAKING CHANGE:`)
- ✅ Creates beta version tag (e.g., `v0.2.4-beta.1`, `v0.2.4-beta.2`)
- ✅ Updates `CHANGELOG.md`
- ✅ Updates `package.json` version
- ✅ Builds and tests the project
- ✅ Publishes to GitHub Packages with `beta` tag
- ✅ Skips if no version-bump commits found

**Install beta version:**
```bash
npm install @bitrockteam/sonarflow@beta
```

#### 2. Production Releases (`main` branch)

**Trigger:** Any push to `main` branch (excluding documentation-only changes)

**What happens:**
- ✅ Checks for version-bump commits
- ✅ Auto-determines version bump:
  - `feat:` → minor bump (0.2.3 → 0.3.0)
  - `fix:` → patch bump (0.2.3 → 0.2.4)
  - `BREAKING CHANGE:` → major bump (0.2.3 → 1.0.0)
- ✅ Creates production version tag (e.g., `v0.2.4`)
- ✅ Updates `CHANGELOG.md`
- ✅ Updates `package.json` version
- ✅ Builds and tests the project
- ✅ Creates GitHub Release with CHANGELOG content
- ✅ Publishes to GitHub Packages with `latest` tag
- ✅ Skips if no version-bump commits found

**Install production version:**
```bash
npm install @bitrockteam/sonarflow@latest
# or simply
npm install @bitrockteam/sonarflow
```

## Commit Message Format

For automated releases to work, **all commits must follow Conventional Commits format:**

### Version-Bump Commits (triggers release)
- `feat: description` - New features → minor bump
- `fix: description` - Bug fixes → patch bump
- `perf: description` - Performance improvements → patch bump
- `refactor: description` - Code refactoring → patch bump
- `BREAKING CHANGE: description` - Breaking changes → major bump

### Non-Version-Bump Commits (skips release)
- `docs: description` - Documentation changes
- `chore: description` - Build/tooling changes
- `style: description` - Code style changes
- `test: description` - Test changes

## Example Workflow

### Scenario 1: New Feature

```bash
# 1. Work on feature branch
git checkout -b feature/new-feature
# ... make changes ...
git commit -m "feat: add support for custom SonarQube rules"
git push origin feature/new-feature

# 2. Merge to develop
# (via PR or direct merge)
git checkout develop
git merge feature/new-feature
git push origin develop

# 3. GitHub Actions automatically:
#    - Creates v0.2.4-beta.1
#    - Publishes to npm with 'beta' tag
#    - Updates CHANGELOG.md

# 4. When ready, merge to main
git checkout main
git merge develop
git push origin main

# 5. GitHub Actions automatically:
#    - Creates v0.3.0 (minor bump because of 'feat:')
#    - Publishes to npm with 'latest' tag
#    - Creates GitHub Release
```

### Scenario 2: Bug Fix

```bash
# 1. Fix bug on develop
git commit -m "fix: correct PR detection for Bitbucket"
git push origin develop

# 2. GitHub Actions:
#    - Creates v0.2.4-beta.2 (increments beta)
#    - Publishes to npm with 'beta' tag

# 3. Merge to main
git checkout main
git merge develop
git push origin main

# 4. GitHub Actions:
#    - Creates v0.2.4 (patch bump because of 'fix:')
#    - Publishes to npm with 'latest' tag
```

## Workflow Files

- `.github/workflows/release-beta.yml` - Beta releases on `develop`
- `.github/workflows/release-production.yml` - Production releases on `main`
- `.github/workflows/README.md` - Detailed workflow documentation

## Configuration

- `.versionrc.json` - Standard-version configuration
- `package.json` - Release scripts and dependencies

## Permissions Required

The GitHub Actions workflows require:
- `contents: write` - To push tags and CHANGELOG updates
- `packages: write` - To publish to GitHub Packages

These are automatically available via `GITHUB_TOKEN` in GitHub Actions.

## Troubleshooting

### Release Not Triggering

**Check:**
1. ✅ Commit messages follow conventional format
2. ✅ Commits contain version-bump types (`feat:`, `fix:`, etc.)
3. ✅ Changes are not in ignored paths (`.md` files are ignored)
4. ✅ Pushed to correct branch (`develop` or `main`)

### Wrong Version Bump

**Solution:**
- Standard-version auto-detects based on commit types
- If wrong, manually override with `bun run release:patch|minor|major`

### Publishing Fails

**Check:**
1. ✅ `GITHUB_TOKEN` has correct permissions
2. ✅ Package name matches in `package.json`
3. ✅ `publishConfig.registry` is set correctly
4. ✅ Review GitHub Actions logs for specific errors

## Monitoring Releases

- **GitHub Actions:** https://github.com/bitrockteam/sonarflow/actions
- **Releases:** https://github.com/bitrockteam/sonarflow/releases
- **Packages:** https://github.com/orgs/bitrockteam/packages

