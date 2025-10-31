# Package Versioning Strategy

## Overview

This document outlines the versioning strategy and tooling for `@bitrockteam/sonarflow` CLI package.

## Recommended Tool: `standard-version`

**Why `standard-version`?**
- ✅ Simple and predictable workflow
- ✅ Follows [Conventional Commits](https://www.conventionalcommits.org/) specification
- ✅ Automatically generates CHANGELOG.md
- ✅ Bumps version in package.json
- ✅ Creates git tags
- ✅ Works seamlessly with GitHub Packages
- ✅ No external services required
- ✅ Full control over release process

## Versioning Strategy

### Semantic Versioning (SemVer)

Follow **Semantic Versioning** format: `MAJOR.MINOR.PATCH`

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features (backward compatible)
- **PATCH** (0.0.x): Bug fixes (backward compatible)

### Conventional Commits

All commits should follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Commit Types:**
- `feat`: New feature (bumps MINOR)
- `fix`: Bug fix (bumps PATCH)
- `docs`: Documentation changes (no version bump)
- `style`: Code style changes (no version bump)
- `refactor`: Code refactoring (bumps PATCH)
- `perf`: Performance improvements (bumps PATCH)
- `test`: Test changes (no version bump)
- `chore`: Build/tooling changes (no version bump)
- `revert`: Revert previous commit
- `BREAKING CHANGE`: Breaking changes (bumps MAJOR)

**Examples:**
```bash
feat: add support for custom SonarQube rules
fix: correct PR detection for Bitbucket branches
feat(cli): add update command to check for new versions
fix(extractor): handle missing security hotspots gracefully

BREAKING CHANGE: remove support for Node.js < 22.21.0
```

## Release Workflow

### Automated Releases (Primary Method)

**This project uses automated releases via GitHub Actions.**

#### Develop Branch → Beta Releases
- **Trigger:** Push to `develop` branch
- **Version Format:** `v{version}-beta.{increment}` (e.g., `v0.2.4-beta.1`)
- **Behavior:**
  - Automatically creates beta/pre-release versions
  - Only releases if there are version-bump commits (`feat:`, `fix:`, `perf:`, `refactor:`, or `BREAKING CHANGE:`)
  - Publishes to GitHub Packages with `beta` tag
  - Skips release if only documentation/chore commits

#### Main Branch → Production Releases
- **Trigger:** Push to `main` branch
- **Version Format:** `v{version}` (e.g., `v0.2.4`, `v0.3.0`)
- **Behavior:**
  - Automatically creates production releases
  - Determines version bump based on commit types (feat → minor, fix → patch, BREAKING → major)
  - Publishes to GitHub Packages with `latest` tag
  - Creates GitHub Release with CHANGELOG content

**No manual intervention required!** Just push to `develop` or `main` with conventional commits.

### Manual Release (Fallback/Override)

If you need to manually create a release:
```bash
# 1. Ensure you're on the target branch
git checkout main  # or develop for beta
git pull origin main

# 2. Run standard-version (will bump version, update CHANGELOG, create tag)
bun run release                    # Auto-detect version
bun run release:patch             # Force patch
bun run release:minor             # Force minor
bun run release:major             # Force major

# 3. Review changes
git diff HEAD~1

# 4. Push changes and tags
git push --follow-tags origin main
```

### 3. Publishing

After version bump and tagging:
```bash
# Build and publish to GitHub Packages
bun run prepublishOnly  # Runs automatically
npm publish
```

## Configuration

### `.versionrc.json` Configuration

```json
{
  "types": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "refactor", "section": "Code Refactoring" },
    { "type": "docs", "section": "Documentation", "hidden": false },
    { "type": "chore", "section": "Chores", "hidden": false }
  ],
  "releaseCommitMessageFormat": "chore(release): {{currentTag}}",
  "scripts": {
    "postchangelog": "echo 'CHANGELOG.md updated successfully'"
  }
}
```

### Package.json Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major",
    "release:patch": "standard-version --release-as patch",
    "release:first": "standard-version --first-release"
  }
}
```

## CHANGELOG Format

The tool generates a `CHANGELOG.md` with sections:
- **Features**: New features
- **Bug Fixes**: Bug fixes
- **Performance Improvements**: Performance enhancements
- **Code Refactoring**: Code refactoring
- **Documentation**: Documentation updates
- **Chores**: Build/tooling changes

## Git Tags

Tags are created automatically in format: `v{version}` (e.g., `v0.3.0`)

## Alternative Tools Considered

### `semantic-release`
- **Pros**: Fully automated, works with CI/CD
- **Cons**: Requires more setup, less control, may be overkill for small team

### `changesets`
- **Pros**: Great for monorepos, PR-based workflow
- **Cons**: More complex for single-package projects

### Manual Versioning
- **Pros**: Full control
- **Cons**: Error-prone, no automation, no CHANGELOG generation

## Implementation Checklist

- [ ] Install `standard-version` as dev dependency
- [ ] Create `.versionrc.json` configuration
- [ ] Add release scripts to `package.json`
- [ ] Initialize CHANGELOG.md with current version
- [ ] Update contributing guidelines with commit message format
- [ ] Set up Husky commit-msg hook (optional but recommended)
- [ ] Test release process on a test branch
- [ ] Document release process in README

## Best Practices

1. **Always review CHANGELOG.md** before pushing release
2. **Use `--dry-run`** first: `bun run release -- --dry-run`
3. **Squash merge PRs** with conventional commit message
4. **Tag releases immediately** after version bump
5. **Publish promptly** after tagging (don't leave unpublished tags)
6. **Keep CHANGELOG.md in version control**

