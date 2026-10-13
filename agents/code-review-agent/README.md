# Code Review Agent

An AI pull request reviewer for your terminal and CI. It reads the diff, opens the files around each change, and returns structured findings with severity, file, line and a concrete fix.

## Features

- Reviews staged changes, the working tree, or `HEAD` against any base branch
- Tools to list changed files, read the diff per file, and read surrounding code (repo-scoped, path-traversal safe)
- Structured findings: `critical`, `major`, `minor`, `nit`, with a verdict
- `--strict` exits with code 1 on critical or major findings, so it can gate CI
- Writes a markdown report to the GitHub Actions job summary automatically
- `--json` output for bots and dashboards

## Tech Stack

- **Runtime**: Node.js 22+ (ES Modules)
- **AI**: [AI SDK 7](https://ai-sdk.dev) `ToolLoopAgent`, [LLM Gateway provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider)
- **Validation**: Zod 4

## Getting Started

### Prerequisites

- Node.js 22+ (24 LTS recommended)
- pnpm
- [LLM Gateway API Key](https://llmgateway.io/dashboard)

### Installation

```bash
# Scaffold it with the CLI
npx @llmgateway/cli init --template code-review-agent

# Or from the root of this monorepo
pnpm install
cd agents/code-review-agent
```

### Environment

Create `.env.local` (or export the variables in your shell):

```env
LLMGATEWAY_API_KEY=your_api_key_here
# Optional
LLMGATEWAY_MODEL=claude-sonnet-5-5
```

## Usage

Build once with `pnpm build`, then run it with `pnpm start`. During development, `pnpm dev` runs the same entry point with `tsx` in watch mode.

It reviews the repository you run it from. Pass `--repo <path>` to review another checkout:

```bash
pnpm start --staged                   # staged changes
pnpm start                            # working tree vs HEAD
pnpm start --base origin/main         # this branch vs main
pnpm start --base origin/main --json  # raw JSON
pnpm start --base origin/main --strict
pnpm start --repo ~/code/my-app --base origin/main
```

Example output:

```markdown
## 🤖 AI code review

**Verdict:** `request_changes` · **Findings:** 2

### 🔴 SQL injection in getUser

`db.ts:4` · critical

The id is interpolated straight into the SQL string...

**Fix:** Use the parameterized form: `pool.query("SELECT * FROM users WHERE id = $1", [id])`.
```

## GitHub Actions

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- run: npx tsx agents/code-review-agent/src/index.ts --base origin/${{ github.base_ref }} --strict
  env:
    LLMGATEWAY_API_KEY: ${{ secrets.LLMGATEWAY_API_KEY }}
```

The review is also appended to the job summary.

## Enterprise deployments

Set `LLMGATEWAY_GATEWAY_URL` to your inference gateway URL (without `/v1`). Set `LLMGATEWAY_MODEL` to a model allowed by your organization. Keep API keys in server-side environment variables.

## License

MIT
