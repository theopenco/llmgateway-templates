# @llmgateway/cli

CLI tool for scaffolding LLM Gateway templates and managing AI projects.

## Installation

```bash
# Use directly with npx (recommended)
npx @llmgateway/cli init

# Or install globally
npm install -g @llmgateway/cli
```

## Commands

### `launch` - Launch coding agents with LLM Gateway configured

Start any supported coding agent pre-wired to LLM Gateway: one API key, 200+ models, and every request tracked in your [dashboard](https://llmgateway.io/dashboard).

```bash
# Interactive picker
npx @llmgateway/cli launch

# Launch a specific agent (shortcuts work too: `llmgateway claude`)
npx @llmgateway/cli launch claude
npx @llmgateway/cli launch opencode
npx @llmgateway/cli launch empryo
npx @llmgateway/cli launch soulforge
npx @llmgateway/cli launch codex

# Pick a model — launcher flags go before the agent name
npx @llmgateway/cli launch -m gpt-5.5 claude

# Everything after the agent name is passed to the agent itself
npx @llmgateway/cli launch claude --continue

# List all supported agents and see which are installed
npx @llmgateway/cli launch --list

# Inspect what would run without launching
npx @llmgateway/cli launch --dry-run codex
```

Supported agents and how they're configured:

| Agent | Launch | Configuration |
| --- | --- | --- |
| Claude Code | `llmgateway claude` | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` env vars |
| OpenCode | `llmgateway opencode` | Built-in `llmgateway` provider via `LLMGATEWAY_API_KEY` |
| Empryo | `llmgateway empryo` | Registers your key via `empryo --set-key llmgateway` |
| SoulForge | `llmgateway soulforge` | Registers your key via `soulforge --set-key llmgateway` |
| Codex CLI | `llmgateway codex` | Per-session `-c` provider overrides (no config file changes) |
| DevPass Code | `llmgateway devpass-code` | `LLMGATEWAY_API_KEY` env var |
| Autohand Code | `llmgateway autohand` | `OPENAI_BASE_URL` + `OPENAI_API_KEY` env vars |
| Pi | `llmgateway pi` | Adds an `llmgateway` provider to `~/.pi/agent/models.json` |
| Kimi Code | `llmgateway kimi` | Adds an `llmgateway` provider to `~/.kimi-code/config.toml` |
| MiMo Code | `llmgateway mimo` | Routes the provider through the gateway in `mimocode.json` |
| OpenClaw | `llmgateway openclaw` | Adds an `llmgateway` provider to `~/.openclaw/openclaw.json` |
| Hermes Agent | `llmgateway hermes` | Runs `hermes setup` with gateway values on first launch |

The API key is resolved from `--key`, the `LLMGATEWAY_API_KEY` environment variable, or the key stored by `llmgateway auth login --key` — in that order. If none is found, you'll be prompted once and the key is saved for next time. If an agent isn't installed, the launcher prints its official install command and exits.

See the [integration guides](https://llmgateway.io/guides) for per-agent details.

### `init` - Create a new project

```bash
# Interactive mode
npx @llmgateway/cli init

# Specify template
npx @llmgateway/cli init --template image-generation

# Specify template and directory
npx @llmgateway/cli init --template weather-agent ./my-agent

# Specify project name
npx @llmgateway/cli init --template image-generation --name my-app
```

### `list` - Show available templates

```bash
npx @llmgateway/cli list
npx @llmgateway/cli list --json
```

### `models` - Browse available models

```bash
# List all models
npx @llmgateway/cli models

# Filter by capability
npx @llmgateway/cli models --capability image

# Filter by provider
npx @llmgateway/cli models --provider openai

# Search by name
npx @llmgateway/cli models --search gpt
```

### `add` - Add tools or routes to your project

```bash
# Interactive mode
npx @llmgateway/cli add

# Add a specific tool
npx @llmgateway/cli add tool weather
npx @llmgateway/cli add tool search
npx @llmgateway/cli add tool calculator

# Add an API route
npx @llmgateway/cli add route generate
npx @llmgateway/cli add route chat
```

### `auth` - Authentication

Two kinds of credentials:

- **Dashboard session** (email & password) — required for `keys`, `budget`, `usage`, `orgs`, `projects`, and `credits`.
- **API key** — used by scaffolded apps to call the gateway itself.

```bash
# Sign in (interactive — pick email & password or API key)
npx @llmgateway/cli auth login

# Sign in with email & password directly
npx @llmgateway/cli auth login --email you@example.com

# Store a gateway API key (opens browser)
npx @llmgateway/cli auth login --key

# Check authentication status / current user
npx @llmgateway/cli auth status
npx @llmgateway/cli auth whoami

# Logout (removes session and stored key)
npx @llmgateway/cli auth logout
```

> Signed up with GitHub or Google? Set a password in the dashboard settings first.

### `keys` - Manage API keys

```bash
# Create a key (interactive project picker if no default set)
npx @llmgateway/cli keys create --description "production"

# Create a key with a budget, rolling period limit, and TTL
npx @llmgateway/cli keys create \
  --description "ci-bot" \
  --project <projectId> \
  --limit 100 \              # total spending limit in USD
  --period-limit 10 \        # USD per rolling period
  --period 1d \              # 12h, 1d, 2w, 1mo
  --expires 30d              # TTL: duration or ISO date

# List keys (add --all to see every key in the org)
npx @llmgateway/cli keys list
npx @llmgateway/cli keys list --project <projectId> --json

# Activate / deactivate
npx @llmgateway/cli keys update <keyId> --deactivate
npx @llmgateway/cli keys update <keyId> --activate --expires 90d

# Regenerate the token
npx @llmgateway/cli keys roll <keyId>

# Delete
npx @llmgateway/cli keys delete <keyId>
```

### `budget` - API key spending limits

```bash
# Set a total budget
npx @llmgateway/cli budget set <keyId> --limit 50

# Set a rolling budget ($5 per day)
npx @llmgateway/cli budget set <keyId> --period-limit 5 --period 1d

# Show budget and current spend
npx @llmgateway/cli budget get <keyId>

# Remove all limits
npx @llmgateway/cli budget set <keyId> --clear
```

### `usage` - Usage & cost analytics

```bash
# Usage for the default project (last 7 days)
npx @llmgateway/cli usage

# By organization (aggregated across its projects)
npx @llmgateway/cli usage --org <orgId>

# By project / by API key
npx @llmgateway/cli usage --project <projectId>
npx @llmgateway/cli usage --api-key <keyId>

# Break down by model or by API key
npx @llmgateway/cli usage --by model
npx @llmgateway/cli usage --by key

# Time windows
npx @llmgateway/cli usage --range 24h        # 1h, 4h, 24h, 7d, 30d, 365d
npx @llmgateway/cli usage --days 14
npx @llmgateway/cli usage --from 2026-06-01 --to 2026-06-12

# By session/agent source
npx @llmgateway/cli usage sources --project <projectId>
```

### `orgs`, `projects`, `credits`

```bash
# List organizations (id, plan, credits)
npx @llmgateway/cli orgs list

# List projects, set a default for keys/usage commands
npx @llmgateway/cli projects list
npx @llmgateway/cli projects use <projectId>

# Show org credit balances
npx @llmgateway/cli credits
```

### `dev` - Start development server

```bash
npx @llmgateway/cli dev
npx @llmgateway/cli dev --port 3001
```

### `upgrade` - Upgrade @llmgateway packages

```bash
# Upgrade packages
npx @llmgateway/cli upgrade

# Check for updates without installing
npx @llmgateway/cli upgrade --check
```

### `docs` - Open documentation

```bash
# Open main docs
npx @llmgateway/cli docs

# Open specific topic
npx @llmgateway/cli docs models
npx @llmgateway/cli docs api
npx @llmgateway/cli docs sdk
```

## Available Templates

| Template           | Description                                               | Type  |
| ------------------ | --------------------------------------------------------- | ----- |
| `image-generation` | Full-stack AI image generation app (Next.js 16, React 19) | Web   |
| `weather-agent`    | CLI agent that answers weather queries using tools        | Agent |

## Configuration

The CLI stores configuration in `~/.llmgateway/config.json`:

```json
{
  "apiKey": "your-api-key",
  "defaultTemplate": "image-generation",
  "sessionEmail": "you@example.com",
  "defaultOrgId": "org_...",
  "defaultProjectId": "proj_..."
}
```

Environment variables take precedence over the config file:

- `LLMGATEWAY_API_KEY` - Your LLM Gateway API key
- `LLMGATEWAY_API_URL` - Management API base URL (defaults to `https://internal.llmgateway.io`; use `http://localhost:4002` for local dev)

## License

MIT
