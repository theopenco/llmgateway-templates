# Support Triage Agent

Triage a batch of support tickets in seconds. Each ticket gets a category, priority, sentiment, language, a one-line summary, a "needs a human" flag and a draft reply in the customer's language. The queue is printed by priority.

## Features

- Batch processing with a concurrency limit
- Categories: billing, bug, outage, account, how-to, feature request, other
- Priorities from `urgent` to `low`, with escalation for refunds, outages and angry customers
- Draft replies in the customer's language that never promise refunds or dates
- Prompt-injection guard: ticket text is treated as data
- JSON export with `--out` for your helpdesk

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
npx @llmgateway/cli init --template support-triage-agent

# Or from the root of this monorepo
pnpm install
cd agents/support-triage-agent
```

### Environment

Create `.env.local` (or export the variables in your shell):

```env
LLMGATEWAY_API_KEY=your_api_key_here
# Optional
LLMGATEWAY_MODEL=claude-haiku-5-5
COMPANY_NAME=Acme
```

## Usage

Build once with `pnpm build`, then run it with `pnpm start`. During development, `pnpm dev` runs the same entry point with `tsx` in watch mode.

```bash
pnpm start                                    # examples/tickets.json
pnpm start my-tickets.json --out triage.json --concurrency 8
```

Input is an array of `{ id, from?, subject?, body }`. Output:

```text
[URGENT] T-1002 · outage · frustrated · en · 🙋 needs human
  Customer reports all streaming requests return HTTP 500, production app is down.
  Reply: Hi there, thank you for reporting this and I'm sorry your production app is affected...

[NORMAL] T-1003 · billing · neutral · de
  Customer asks to change the company address shown on their invoice.
  Reply: Hallo, vielen Dank für Ihre Nachricht...

Queue: 1 urgent · 1 high · 1 normal · 1 low · 2 need a human
```

## Enterprise deployments

Set `LLMGATEWAY_GATEWAY_URL` to your inference gateway URL (without `/v1`). Set `LLMGATEWAY_MODEL` to a model allowed by your organization. Keep API keys in server-side environment variables.

## License

MIT
