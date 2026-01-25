# Releasing

This document describes the release process for packages in this repository.

## @llmgateway/cli

### Automated Release (Recommended)

Use the GitHub Actions workflow to publish a new version:

1. Go to [Actions → Publish CLI](../../actions/workflows/publish-cli.yml)
2. Click "Run workflow"
3. Enter the version:
   - `patch` - Bug fixes (0.1.0 → 0.1.1)
   - `minor` - New features (0.1.0 → 0.2.0)
   - `major` - Breaking changes (0.1.0 → 1.0.0)
   - Or a specific version like `0.2.0`
4. Click "Run workflow"

The workflow will:
- Build the package
- Bump the version in package.json
- Commit the version change
- Create a git tag (`cli@x.x.x`)
- Publish to npm
- Create a GitHub Release with auto-generated notes

### Manual Release

If you need to release manually:

```bash
cd packages/llmgateway-cli

# Bump version
npm version patch  # or minor, major, or specific version

# Build
pnpm build

# Publish
pnpm publish --access public

# Push tags
git push origin main --tags
```

## Required Secrets

Make sure these secrets are configured in GitHub repository settings:

- `NPM_TOKEN` - npm access token with publish permissions
  - Create at: https://www.npmjs.com/settings/~/tokens
  - Type: Automation token (recommended) or Publish token

## Tag Format

Tags follow the format `cli@{version}` (e.g., `cli@0.1.0`).

This allows for multiple packages in the monorepo to have independent versioning in the future.
