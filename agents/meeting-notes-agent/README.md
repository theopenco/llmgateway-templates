# Meeting Notes Agent

Turn a raw meeting transcript into clean notes: summary, decisions, action items with owners and due dates, open questions and risks. Optionally post them to Slack or Discord.

## Features

- Works with `.txt`, `.md`, `.vtt` and `.srt` transcripts
- Structured output with a Zod schema, rendered as markdown
- Action items as a checklist with owner and due date
- `--out` saves the notes, `--post` sends them to a Slack or Discord webhook
- Built-in sample transcript to try it in seconds

## Tech Stack

- **Runtime**: Node.js 22+ (ES Modules)
- **AI**: [AI SDK 7](https://ai-sdk.dev) structured output, [LLM Gateway provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider)
- **Validation**: Zod 4

## Getting Started

### Prerequisites

- Node.js 22+ (24 LTS recommended)
- pnpm
- [LLM Gateway API Key](https://llmgateway.io/dashboard)

### Installation

```bash
# Scaffold it with the CLI
npx @llmgateway/cli init --template meeting-notes-agent

# Or from the root of this monorepo
pnpm install
cd agents/meeting-notes-agent
```

### Environment

Create `.env.local` (or export the variables in your shell):

```env
LLMGATEWAY_API_KEY=your_api_key_here
# Optional
LLMGATEWAY_MODEL=gemini-3.8-flash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Usage

Build once with `pnpm build`, then run it with `pnpm start`. During development, `pnpm dev` runs the same entry point with `tsx` in watch mode.

```bash
pnpm start                                   # sample transcript
pnpm start standup.vtt --out notes.md        # your transcript
pnpm start standup.vtt --post                # post to Slack/Discord
```

```markdown
# v2 Launch Date Discussion

The team moved the v2 launch from Monday the 20th to Wednesday the 22nd...

## Action items

- [ ] **Tom** — Add a fallback test plan _(due Friday)_
- [ ] **Ana** — Confirm the press embargo with the agency
```

The default model is `gemini-3.8-flash` for its long context window, so hour-long transcripts fit in one call.

## Enterprise deployments

Set `LLMGATEWAY_GATEWAY_URL` to your inference gateway URL (without `/v1`). Set `LLMGATEWAY_MODEL` to a model allowed by your organization. Keep API keys in server-side environment variables.

## License

MIT
