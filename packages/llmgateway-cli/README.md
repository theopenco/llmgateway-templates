# @llmgateway/cli

Scaffold 16 AI projects, sign in through your browser or enterprise SSO, install organization skills, and launch coding agents with LLM Gateway.

Requires Node.js 20.19+ (Node.js 22 or later recommended).

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
npx @llmgateway/cli launch -m gpt-5.4 claude

# Everything after the agent name is passed to the agent itself
npx @llmgateway/cli launch claude --continue

# List all supported agents and see which are installed
npx @llmgateway/cli launch --list

# Inspect what would run without launching
npx @llmgateway/cli launch --dry-run codex
```

Supported agents and how they're configured:

| Agent         | Launch                    | Configuration                                                                                                                |
| ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Aider         | `llmgateway aider`        | OpenAI-compatible provider, explicit model and gateway URL                                                                   |
| Qwen Code     | `llmgateway qwen`         | OpenAI authentication, explicit model and gateway URL                                                                        |
| Goose         | `llmgateway goose`        | OpenAI provider, model and host environment                                                                                  |
| DevPass Code  | `llmgateway devpass-code` | First-party agent — key refreshed in its `auth.json` + `LLMGATEWAY_API_KEY`                                                  |
| Claude Code   | `llmgateway claude`       | `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` env vars + gateway model discovery, so `/model` lists the gateway catalog      |
| OpenCode      | `llmgateway opencode`     | Built-in `llmgateway` provider — key refreshed in its `auth.json`, provider-pinned model catalog synced into `opencode.json` |
| Empryo        | `llmgateway empryo`       | Registers your key via `empryo --set-key llmgateway` (finds the desktop app's CLI too)                                       |
| SoulForge     | `llmgateway soulforge`    | Registers your key via `soulforge --set-key llmgateway`                                                                      |
| Codex CLI     | `llmgateway codex`        | Per-session `-c` provider overrides (no config file changes)                                                                 |
| Autohand Code | `llmgateway autohand`     | `OPENAI_BASE_URL` + `OPENAI_API_KEY` env vars                                                                                |
| Pi            | `llmgateway pi`           | Adds an `llmgateway` provider to `~/.pi/agent/models.json`                                                                   |
| Kimi Code     | `llmgateway kimi`         | Temporary `KIMI_MODEL_*` environment; picks up rotated keys each launch                                                      |
| MiMo Code     | `llmgateway mimo`         | Routes the provider through the gateway in `mimocode.json`                                                                   |
| OpenClaw      | `llmgateway openclaw`     | Adds an `llmgateway` provider to `~/.openclaw/openclaw.json`                                                                 |
| Hermes Agent  | `llmgateway hermes`       | Selects the native `llmgateway` provider and requested model                                                                 |

The API key is resolved from `--key`, `LLMGATEWAY_API_KEY`, or the key stored by `auth login --key`, in that order. Launching makes no inference request until the agent runs. Use `--check-key` to opt into a one-token credential check, which can incur a charge. A rejected selected key stops the launch. Missing agents produce installation instructions; the launcher never installs them automatically.

Use `--gateway-url https://gateway.example.com` before the agent name for a private deployment. OpenCode and DevPass receive runtime endpoint overrides, and file-based integrations refresh their gateway configuration on launch. Empryo, SoulForge, and Hermes use their native hosted provider; for a private endpoint, register a custom launcher using that agent's enterprise configuration. Hermes requires a version with the native `llmgateway` provider.

`--dry-run` is offline, redacts the selected key, and does not change agent files. Child exit codes and termination signals propagate to your shell.
See the [integration guides](https://llmgateway.io/guides) for per-agent details.

### `configure` - Generate agent configs with the gateway's models

Put LLM Gateway's coding-model catalog directly into an agent's own config, so its model picker lists gateway models without launching through the CLI:

```bash
# opencode: adds every coding model, pinned per upstream provider, to the picker
npx @llmgateway/cli configure opencode

# Claude Code: routes it through LLM Gateway and fills /model from the gateway catalog
npx @llmgateway/cli configure claude

# ...for the current repo only (.claude/settings.local.json)
npx @llmgateway/cli configure claude --project

# Preview without writing
npx @llmgateway/cli configure opencode --dry-run
```

- **opencode** — merges `provider/model` entries (e.g. `anthropic/claude-sonnet-5`, `aws-bedrock/claude-sonnet-5`) into `provider.llmgateway.models` in `~/.config/opencode/opencode.json`, with display names, context limits, and per-provider pricing. They show up in the picker as `llmgateway/<provider>/<model>` and pin that upstream provider via the gateway's [provider-routing syntax](https://docs.llmgateway.io/features/routing#provider-specific-routing). Root model ids (auto-routed) are already built into opencode. Existing custom entries and the rest of the file are preserved, and a hand-written `opencode.jsonc` keeps working alongside it.
- **Claude Code** — sets `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` in `~/.claude/settings.json` (requires Claude Code v2.1.129+). Claude Code then loads the gateway's `/v1/models` catalog into its `/model` picker (shown as "From gateway"). Claude Code only lists ids starting with `claude`/`anthropic`; any other gateway model still works via `claude --model <id>`.

`llmgateway launch opencode` and `llmgateway launch claude` apply the same setup automatically on every launch, keeping the catalog fresh as new models ship.

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

### `auth` - Browser and SSO authentication

```bash
# Open your browser, sign in, compare the code, and approve
llmgateway auth login

# Go directly to your organization's SSO sign-in
llmgateway auth login --sso you@example.com

# Remote terminal: display a link and code without opening a browser
llmgateway auth login --no-browser --timeout 600

# Private deployment: configure all three service URLs
llmgateway auth login --sso \
  --api-url https://management.example.com \
  --dashboard-url https://dashboard.example.com \
  --gateway-url https://gateway.example.com

llmgateway auth status
llmgateway auth whoami
llmgateway auth logout

# Compatibility with deployments that do not have device authorization
llmgateway auth login --email you@example.com
llmgateway auth login --key
```

Browser sign-in uses the dashboard's existing login methods, including SSO. Approve only the code shown in your own terminal. The CLI polls for its own session; browser URLs contain no session token. `--sso` optionally accepts a work email and uses the configured dashboard's SSO page. Login expires after ten minutes by default; Ctrl-C cancels without saving credentials.

The management API needs Better Auth device authorization and bearer support, and the dashboard needs `/connect/device`. See [the deployment contract](./docs/enterprise.md). Older deployments get an explicit compatibility error. Email/password sign-in remains subject to organization SSO enforcement.

A dashboard session manages organizations, keys, and skills. Running inference or launching a coding agent also needs a project API key: create one with `llmgateway keys create`, store one with `auth login --key`, or export `LLMGATEWAY_API_KEY`. API keys do not replace dashboard sessions for management commands. Logout revokes the CLI session when reachable and clears local credentials, while retaining deployment URLs and registered custom agents.

### `skills` - Organization skills

```bash
llmgateway orgs list
llmgateway orgs use <org-id>
llmgateway skills list --json
llmgateway skills show code-review
llmgateway skills add code-review --agent claude
llmgateway skills add --all --agent codex --dry-run
llmgateway skills add --all --agent codex
llmgateway skills add code-review --global --agent opencode
llmgateway skills publish ./SKILL.md --org <org-id>
```

`--org` accepts an organization ID or an unambiguous name. The selected organization is checked against your current memberships. A single organization is selected automatically; scripts with multiple organizations must pass `--org` or set a default.

Skills come from the organization's enabled catalog, including their supporting files. The default installation target is `.agents/skills/<name>/SKILL.md`. Supported targets are `agents`, `codex`, `claude`, `opencode`, `cursor`, `qwen`, and `pi`; `--global` uses the agent's home-directory location. Review a skill with `show` before installing it. Installation writes files; it does not execute skill scripts.

Existing skill directories are preserved unless you pass `--force`, which replaces the entire selected skill bundle. Disabled skills, unsafe paths, symlink destinations, duplicate filenames, and bundles over 1 MiB are rejected before installation. `--all` downloads enabled skills in the selected organization only. Publishing a single `SKILL.md` requires an enterprise organization and an owner/admin role; use the dashboard to manage supporting files and existing versions.

### `agents` - Custom coding agents

Register an executable and its arguments from a trusted JSON file:

```json
{
  "id": "company-agent",
  "label": "Company coding agent",
  "description": "Our internal OpenAI-compatible agent",
  "command": "company-agent",
  "args": ["--model", "${model}"],
  "defaultModel": "gpt-5.4",
  "env": {
    "OPENAI_API_KEY": "${apiKey}",
    "OPENAI_BASE_URL": "${gatewayUrl}/v1"
  }
}
```

```bash
llmgateway agents add ./company-agent.json
llmgateway agents list --json
llmgateway launch --dry-run company-agent
llmgateway launch -m your-model company-agent --resume
llmgateway agents show company-agent > shared-agent.json
llmgateway agents remove company-agent
```

Definitions support `${model}`, `${gatewayUrl}`, and `${apiKey}`. Credentials are allowed only in environment values; arguments are passed literally without a shell. `command` must be an executable name or absolute path, not a shell command line. Definitions cannot replace built-in agents. Use `agents add --force` to replace an existing custom definition. Registration is explicit and stores definitions in your CLI configuration directory; repository files are never executed automatically. The [example definition](./examples/company-agent.json) can be distributed through your enterprise's normal configuration tooling.

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
npx @llmgateway/cli orgs use <orgId>

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

Web templates: `ai-chatbot`, `ai-slides`, `image-generation`, `og-image-generator`, `feedback-dashboard`, `writing-assistant`, `qa-agent`, `slack-qa-bot`, `embeddable-credits`, and `showcase`.

CLI agents: `weather-agent`, `lead-agent`, `changelog-generator-agent`, `email-drafter-agent`, `sentiment-analyzer-agent`, and `data-extractor-agent`.

```bash
# Reproducible scaffolding from a reviewed Git ref, without installing
llmgateway init my-app --template ai-chatbot --ref main --no-install
```

All templates include a README and standalone dependency versions. AI templates use AI SDK 6 and accept `LLMGATEWAY_GATEWAY_URL` for private inference endpoints. CLI agent templates also accept `LLMGATEWAY_MODEL`.

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

Deployment environment variables override stored settings; an explicit launch `--gateway-url` overrides its environment default. URLs must use HTTPS, except local loopback development servers.

| Variable                 | Purpose                                  | Default                          |
| ------------------------ | ---------------------------------------- | -------------------------------- |
| `LLMGATEWAY_API_KEY`     | Project inference key                    | Stored key                       |
| `LLMGATEWAY_API_URL`     | Management API and authentication        | `https://internal.llmgateway.io` |
| `LLMGATEWAY_ORIGIN_URL`  | Dashboard and SSO origin                 | `https://llmgateway.io`          |
| `LLMGATEWAY_GATEWAY_URL` | Inference gateway root, without `/v1`    | `https://api.llmgateway.io`      |
| `LLMGATEWAY_CONFIG_DIR`  | Configuration and custom agent directory | `~/.llmgateway`                  |

Session credentials are bound to the management instance that issued them and are not forwarded after an API URL change. Logging into a different account or instance clears stored project defaults and the stored inference key. For separate simultaneous deployments, use separate `LLMGATEWAY_CONFIG_DIR` directories. Credentials are stored with owner-only file permissions on POSIX systems. For email/key compatibility login, set deployment URLs through environment variables.

## License

MIT
