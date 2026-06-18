# Slack Q&A Bot Template

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftheopenco%2Fllmgateway-templates&env=SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,REDIS_URL,LLM_GATEWAY_API_KEY&envDescription=Slack%20credentials%2C%20a%20Redis%20URL%2C%20and%20your%20LLM%20Gateway%20API%20key&envLink=https%3A%2F%2Fllmgateway.io&project-name=slack-qa-bot&repository-name=slack-qa-bot&root-directory=templates/slack-qa-bot)

A Slack bot that answers questions. Mention it in a channel, open its assistant pane, or send it a DM — it streams an AI answer back and keeps the thread's context for follow-up questions.

Built with [Chat SDK](https://github.com/vercel/chat), the [AI SDK](https://ai-sdk.dev), the [LLM Gateway provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider), [Hono](https://hono.dev), and Redis.

## How It Works

1. A user mentions the bot (`@qa-bot how do I ...?`) or sends it a direct message.
2. The bot subscribes to that thread, fetches recent messages for context, and converts them to AI SDK format with `toAiMessages()`.
3. It streams the answer from a `ToolLoopAgent` backed by [LLM Gateway](https://llmgateway.io) straight into Slack using native streaming.
4. Follow-up messages in the same thread are answered automatically — no need to re-mention. Reply `stop` (or `unsubscribe`) and the bot leaves the thread.

The model defaults to `anthropic/claude-sonnet-4-6` and is configurable via the `AI_MODEL` environment variable. Because everything routes through LLM Gateway, you can point `AI_MODEL` at any of 300+ models from OpenAI, Anthropic, Google, and others with the same API key.

### Web search

LLM Gateway runs web search server-side, so the bot can answer questions about current events and recent releases. It's enabled by passing `extraBody: { web_search: true }` on the model and is on by default — set `WEB_SEARCH=false` to turn it off. The model is prompted to cite its sources inline as markdown links, which render as clickable links in Slack.

## Tech Stack

- **Framework**: [Chat SDK](https://github.com/vercel/chat) (`chat` + `@chat-adapter/slack` + `@chat-adapter/state-redis`)
- **AI**: [AI SDK](https://ai-sdk.dev) (`ToolLoopAgent` + streaming) via the [LLM Gateway provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider)
- **Server**: [Hono](https://hono.dev) (a single fetch handler, deployable anywhere)
- **State**: Redis (thread subscriptions + distributed locking)
- **Tests**: Vitest

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io)
- A [Slack app](https://api.slack.com/apps)
- [Redis](https://redis.io)
- An [LLM Gateway API key](https://llmgateway.io)

### Installation

```bash
# From the root of the monorepo
pnpm install

# Or scaffold this template standalone with the CLI
npx @llmgateway/cli init --template slack-qa-bot
```

### Environment Variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

```sh
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Redis (thread subscriptions + distributed locking)
REDIS_URL=redis://localhost:6379

# LLM Gateway (https://llmgateway.io)
LLM_GATEWAY_API_KEY=llmgtwy_...

# Optional: any provider/model id from https://llmgateway.io/models
AI_MODEL=anthropic/claude-sonnet-4-6

# Optional: set to false to turn off LLM Gateway's web search (on by default)
WEB_SEARCH=true
```

### Slack App Configuration

The quickest way to get started is to create your app from the included manifest:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From a manifest**
2. Select your workspace, paste the contents of [`slack-manifest.json`](./slack-manifest.json), and create the app
3. Replace `https://example.com` in both **Event Subscriptions** and **Interactivity & Shortcuts** with your actual domain (or ngrok URL during development)
4. Install the app to your workspace
5. Copy the **Bot User OAuth Token** from **OAuth & Permissions** and the **Signing Secret** from **Basic Information** into your `.env.local`

<details>
<summary>Manual setup (without manifest)</summary>

1. Create a new Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Under **OAuth & Permissions**, add the bot token scopes: `app_mentions:read`, `assistant:write`, `channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `im:read`, `im:write`, `mpim:history`, `mpim:read`, `users:read`
3. Under **Event Subscriptions**, set the request URL to `https://<your-domain>/api/webhooks/slack` and subscribe to the bot events: `app_mention`, `assistant_thread_started`, `assistant_thread_context_changed`, `message.channels`, `message.groups`, `message.im`, `message.mpim`
4. Enable **Agents & AI Apps** (the assistant view) so the bot appears in the assistant pane
5. Enable **Interactivity & Shortcuts** and set the same request URL
6. Install the app to your workspace, then copy the **Bot User OAuth Token** and the **Signing Secret** from **Basic Information**

</details>

### Development

```bash
pnpm dev
```

Starts a local server at `http://localhost:3000` with hot reload via `tsx watch`.

#### Exposing your local server

Slack needs a public URL to deliver webhook events. Use [ngrok](https://ngrok.com) to tunnel traffic to your local server:

```bash
ngrok http 3000
```

Copy the generated URL (e.g. `https://abc123.ngrok-free.dev`) and set it as the request URL in your Slack app:

- **Event Subscriptions** → `https://<ngrok-url>/api/webhooks/slack`
- **Interactivity & Shortcuts** → `https://<ngrok-url>/api/webhooks/slack`

#### Trying it out

Once the app is installed and your tunnel is running, invite the bot to a channel and mention it:

```
@qa-bot what's the difference between TCP and UDP?
```

Or open a DM with the bot and just ask. Follow-up messages in the same thread continue the conversation.

## API

### `GET /`

Health check. Returns `{ "bot": "qa-bot", "status": "ok" }`.

### `POST /api/webhooks/slack`

Receives Slack events and interaction payloads. This is set as the request URL in your Slack app configuration. Chat SDK handles signature verification, URL verification challenges, deduplication, and Slack's 3-second ack window automatically.

## Deployment

The app exports a standard [Hono](https://hono.dev) `fetch` handler, so it can be deployed to any fetch-compatible runtime (Vercel, Cloudflare Workers, AWS, your own server). `src/lib/local.ts` wraps it with `@hono/node-server` for local development only.

After deploying, point your Slack app's **Event Subscriptions** and **Interactivity** request URLs at `https://<your-domain>/api/webhooks/slack`.

## Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `pnpm dev`        | Start dev server with hot reload |
| `pnpm build`      | Compile TypeScript to `dist/`    |
| `pnpm start`      | Run the compiled server          |
| `pnpm test`       | Run tests with coverage          |
| `pnpm type-check` | Type-check without emitting      |
| `pnpm lint`       | Lint with ESLint                 |

## Project Structure

```
src/
  index.ts            Hono app with HTTP routes
  bot.ts              Chat SDK bot instance and event handlers
  lib/
    ai.ts             LLM Gateway provider + ToolLoopAgent + answer() stream helper
    state.ts          Redis state adapter (subscriptions + locking)
    local.ts          Local dev server entrypoint
tests/
  *.test.ts           Unit tests (vitest)
```

## Choosing a model

The bot routes through [LLM Gateway](https://llmgateway.io), which exposes 300+ models behind a single API key. Set `AI_MODEL` to any `provider/model` id from the [model list](https://llmgateway.io/models), for example:

```sh
AI_MODEL=openai/gpt-4o
AI_MODEL=google/gemini-2.5-pro
AI_MODEL=anthropic/claude-opus-4-6
```

## Adding Other Platforms

Chat SDK lets the same handlers answer questions on Microsoft Teams, Google Chat, Discord, or Telegram. Register additional adapters:

```typescript
// src/bot.ts
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createGoogleChatAdapter } from "@chat-adapter/gchat";

export const bot = new Chat({
  adapters: {
    slack: createSlackAdapter(),
    teams: createTeamsAdapter(),
    gchat: createGoogleChatAdapter(),
  },
  state,
  userName: "qa-bot",
});
```

Then extend the `/api/webhooks/:platform` route in `src/index.ts` to dispatch to the new adapter's handler. See the [Chat SDK adapter docs](https://chat-sdk.dev/adapters) for the full list of supported platforms.
