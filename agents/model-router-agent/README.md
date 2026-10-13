# Model Router Agent

Send every prompt to the cheapest model that can answer it well. A small router model classifies each prompt as `simple`, `standard` or `complex`, then the agent streams the answer from the matching tier and prints latency, tokens and the exact cost reported by LLM Gateway.

## Features

- Structured routing decision with a one-line reason
- Three tiers, each mapped to any of the 200+ models on the gateway
- Streams the answer and reports time to first token, total time and tokens
- Shows the real cost of the answer and of the routing call
- One API key for every provider

## Tech Stack

- **Runtime**: Node.js 22+ (ES Modules)
- **AI**: [AI SDK 7](https://ai-sdk.dev), [LLM Gateway provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider)
- **Validation**: Zod 4

## Getting Started

### Prerequisites

- Node.js 22+ (24 LTS recommended)
- pnpm
- [LLM Gateway API Key](https://llmgateway.io/dashboard)

### Installation

```bash
# Scaffold it with the CLI
npx @llmgateway/cli init --template model-router-agent

# Or from the root of this monorepo
pnpm install
cd agents/model-router-agent
```

### Environment

Create `.env.local` (or export the variables in your shell):

```env
LLMGATEWAY_API_KEY=your_api_key_here
# Optional: swap any tier
ROUTER_MODEL=gpt-6-luna
SIMPLE_MODEL=gpt-6-luna
STANDARD_MODEL=claude-sonnet-5-5
COMPLEX_MODEL=gpt-6.1-sol
```

## Usage

Build once with `pnpm build`, then run it with `pnpm start`. During development, `pnpm dev` runs the same entry point with `tsx` in watch mode.

```bash
pnpm start                                  # three demo prompts
pnpm start "What is the capital of Australia?"
pnpm start --help                           # show the tier map
```

```text
Prompt: What is the capital of Australia?
Route:  simple → gpt-6-luna (This is a straightforward factual lookup.)
Canberra.
First token 2453ms · total 2555ms · 35 tokens · answer $0.000012 + routing $0.000031

Prompt: Design a sharding strategy for a multi-tenant Postgres database...
Route:  complex → gpt-6.1-sol (This requires comparing sharding architectures...)
```

Costs come from `providerMetadata.llmgateway.usage.cost`, enabled with `{ usage: { include: true } }` on the model.

## License

MIT
