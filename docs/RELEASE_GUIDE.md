# Release Guide

Quick reference for releasing new versions of `@bitrockteam/sonarflow`.

## Automated Releases (Primary Method)

**Releases are now fully automated via GitHub Actions!**

### How It Works

#### Beta Releases (Develop Branch)
- **Trigger:** Push commits to `develop` branch
- **Process:**
  1. Work on feature branches
  2. Merge to `develop` with conventional commits
  3. GitHub Actions automatically:
     - Creates beta version (e.g., `v0.2.4-beta.1`)
     - Updates CHANGELOG.md
     - Creates git tag
     - Publishes to GitHub Packages with `beta` tag

#### Production Releases (Main Branch)
- **Trigger:** Push commits to `main` branch (usually via PR merge from `develop`)
- **Process:**
  1. Merge `develop` → `main`
  2. GitHub Actions automatically:
     - Creates production version (e.g., `v0.2.4`)
     - Updates CHANGELOG.md
     - Creates git tag
     - Creates GitHub Release
     - Publishes to GitHub Packages with `latest` tag

**No manual steps required!** Just use conventional commits and push to the appropriate branch.

## Manual Release (Override/Fallback)

If you need to manually create a release (e.g., urgent hotfix):

### Prerequisites
- Ensure all changes are committed and pushed
- Run tests and linting: `bun run check`
- Build the project: `bun run build`

### Release Process

1. **Create Release**
   ```bash
   bun run release
   ```
   This will:
   - Analyze commits since last release
   - Determine version bump (patch/minor/major)
   - Update `CHANGELOG.md`
   - Bump version in `package.json`
   - Create a git tag

2. **Review Changes**
   ```bash
   git diff HEAD~1
   git log --oneline
   ```

3. **Push Release**
   ```bash
   git push --follow-tags origin main  # or develop for beta
   ```

4. **Publish to GitHub Packages** (if automated publish failed)
   ```bash
   npm publish
   ```

## Release Types

### Automatic (Recommended)
```bash
bun run release
```
Standard-version automatically determines version bump based on commit types:
- `feat:` → minor bump
- `fix:` → patch bump
- `BREAKING CHANGE:` → major bump

### Manual Override
```bash
# Force patch release (0.2.3 → 0.2.4)
bun run release:patch

# Force minor release (0.2.3 → 0.3.0)
bun run release:minor

# Force major release (0.2.3 → 1.0.0)
bun run release:major
```

## Commit Message Examples

### ✅ Good Commit Messages
```bash
feat: add support for custom SonarQube base URLs
fix: correct PR detection for Bitbucket pull requests
perf: optimize API calls by caching responses
docs: update README with installation instructions
refactor: simplify SonarQube issue extractor logic

BREAKING CHANGE: remove support for Node.js < 22.21.0
```

### ❌ Bad Commit Messages
```bash
update stuff
fixed bug
changes
WIP
```

## Testing Release (Dry Run)

Before actual release, test what would happen:
```bash
bun run release -- --dry-run
```

This shows what would change without actually modifying files.

## Troubleshooting

### Release Fails: No Changes Detected
- Ensure you have commits since the last tag
- Check that commits follow conventional format

### Wrong Version Bump
- Use manual override (`release:patch`, `release:minor`, `release:major`)
- Or manually edit version in `package.json` and tag

### Need to Undo a Release
```bash
# Remove the tag (local)
git tag -d v0.3.0

# Remove the tag (remote)
git push origin :refs/tags/v0.3.0

# Reset to before release commit
git reset --hard HEAD~1
```

## First Release

If this is the first release and no tags exist:
```bash
bun run release:first
```

This initializes the versioning system.

