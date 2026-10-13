# Research Agent

A deep-research CLI agent. It breaks a question into sub-questions, searches the live web, reads the most important sources, and writes a cited markdown report.

## Features

- Multi-step research loop built on the AI SDK `ToolLoopAgent`
- Live web search through LLM Gateway's built-in `web_search`, no search API key needed
- `readPage` tool to verify numbers and quotes against the source
- Cited markdown report with TL;DR, findings, open questions and numbered sources
- Saves every report to `reports/<question>.md`
- Two models: a strong writer and a cheap search model, both swappable

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
npx @llmgateway/cli init --template research-agent

# Or from the root of this monorepo
pnpm install
cd agents/research-agent
```

### Environment

Create `.env.local` (or export the variables in your shell):

```env
LLMGATEWAY_API_KEY=your_api_key_here
# Optional
LLMGATEWAY_MODEL=gpt-6.1-sol
LLMGATEWAY_SEARCH_MODEL=gpt-6-luna
```

## Usage

Build once with `pnpm build`, then run it with `pnpm start`. During development, `pnpm dev` runs the same entry point with `tsx` in watch mode.

```bash
pnpm start "How do the top vector databases compare on cost?"
pnpm start "What changed in the EU AI Act this year?"
```

The agent prints each tool call as it works, then the report:

```text
Question: What is the latest stable version of Node.js and when does its LTS end?
Models:   gpt-6.1-sol (writer), gpt-6-luna (web search)

  → webSearch: latest Node.js release
  → readPage: https://nodejs.org/en/download
  → readPage: https://github.com/nodejs/Release/blob/main/schedule.json

# Latest stable Node.js version
**TL;DR** — ...
Saved report to reports/what-is-the-latest-stable-version-of-node-js.md
```

## How it works

| Tool        | What it does                                                             |
| ----------- | ------------------------------------------------------------------------ |
| `webSearch` | Runs a nested agent on `LLMGATEWAY_SEARCH_MODEL` with `web_search: true` |
| `readPage`  | Fetches a URL and strips it to readable text (12k characters max)        |

The writer model is limited to 12 steps. Raise `isStepCount(12)` in `src/index.ts` for deeper research.

## Enterprise deployments

Set `LLMGATEWAY_GATEWAY_URL` to your inference gateway URL (without `/v1`). Set `LLMGATEWAY_MODEL` to a model allowed by your organization. Keep API keys in server-side environment variables.

## License

MIT
