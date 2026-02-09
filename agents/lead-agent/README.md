# Lead Agent

A command-line AI agent that researches a person by name or email and produces a structured profile summary, optionally posting it to Discord via webhook.

## Features

- Research any person by name or email
- Structured profile summaries (bio, role, background, social links)
- Built-in web search via Perplexity's sonar-pro model
- Optional Discord webhook integration
- Tool-based agentic architecture
- Type-safe with Zod validation

## Tech Stack

- **Runtime**: Node.js 20+ (ES Modules)
- **Language**: TypeScript 5.7
- **AI**: Vercel AI SDK, LLM Gateway Provider
- **Model**: Perplexity sonar-pro (web-search enabled)
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- [LLM Gateway API Key](https://llmgateway.io)

### Installation

```bash
# From the root of the monorepo
pnpm install

# Or standalone
cd agents/lead-agent
pnpm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API key:

```env
LLMGATEWAY_API_KEY=your_api_key_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Development

```bash
# Research a person by name
pnpm dev "Elon Musk"

# Research by email
pnpm dev "john@example.com"

# Default demo query (Sam Altman)
pnpm dev
```

The agent will run with watch mode, automatically restarting on file changes.

### Production Build

```bash
pnpm build
pnpm start "Jane Doe"
```

## Project Structure

```
lead-agent/
├── src/
│   └── index.ts      # Main agent implementation
├── dist/             # Compiled output
├── .env.example      # Environment template
├── tsconfig.json     # TypeScript config
└── package.json
```

## How It Works

The lead agent uses Perplexity's sonar-pro model which has built-in web search capabilities:

1. **User Query**: The agent receives a person's name or email as input
2. **Web Research**: Perplexity's model searches the web for information about the person
3. **Summary Generation**: The model produces a structured profile summary
4. **Discord Notification**: Optionally posts the summary to a Discord channel via webhook

### Available Tools

#### `sendToDiscord`

Send a formatted message to a Discord channel via webhook.

**Parameters:**
- `message` (string): The formatted summary to send

**Environment:**
- `DISCORD_WEBHOOK_URL`: Discord webhook URL (optional — if unset, the tool reports that Discord is not configured)

## Example Queries

```bash
# By name
pnpm dev "Elon Musk"

# By email
pnpm dev "satya@microsoft.com"

# Full name with context
pnpm dev "Jensen Huang, CEO of NVIDIA"
```

## Discord Integration

To enable Discord notifications:

1. Open your Discord server settings
2. Go to **Integrations** > **Webhooks**
3. Click **New Webhook**, choose a channel, and copy the webhook URL
4. Add it to your `.env.local`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

If `DISCORD_WEBHOOK_URL` is not set, the agent will still output the summary to the console.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Name/Email  │────▶│  Lead Agent  │────▶│  LLM Gateway     │
│  Input       │     │  Loop        │     │  (Perplexity)    │
└──────────────┘     └──────┬───────┘     │  + Web Search    │
                            │             └──────────────────┘
                            ▼
                     ┌──────────────┐
                     │    Tools     │
                     │ - sendTo     │
                     │   Discord    │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Discord    │
                     │   Webhook    │
                     └──────────────┘
```

## License

MIT
