# Scripts Directory

## `update-schema-version.js`

Automatically updates the schema file's `$id` field during the release process.

### Purpose

The JSON schema file (`schemas/sonarflowrc.schema.json`) contains a `$id` field that references the specific version of the schema on GitHub. This must be updated every time a new version is released so that the schema URL points to the correct version tag.

### How It Works

1. **Triggered by standard-version**: The script is called via the `postbump` hook in `.versionrc.json`
2. **Runs after version bump**: Standard-version has already updated `package.json` with the new version
3. **Updates schema $id**: Reads the new version from `package.json` and updates the schema file's `$id` field
4. **Included in release commit**: Standard-version automatically stages and commits all changes, including the schema update

### Integration

The script is integrated via `.versionrc.json`:

```json
{
  "scripts": {
    "postbump": "node scripts/update-schema-version.js"
  }
}
```

### Version Format

- **Production releases**: `v0.2.4` → `https://raw.githubusercontent.com/bitrockteam/sonarflow/v0.2.4/schemas/sonarflowrc.schema.json`
- **Beta releases**: `v0.2.4-beta.1` → `https://raw.githubusercontent.com/bitrockteam/sonarflow/v0.2.4-beta.1/schemas/sonarflowrc.schema.json`

### Manual Execution

You can run the script manually to update the schema:

```bash
node scripts/update-schema-version.js
```

This is useful for testing or if you need to update the schema outside of a release.

