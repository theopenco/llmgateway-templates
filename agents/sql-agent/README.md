# SQL Agent

Ask questions about your data in plain English. The agent reads the schema, writes SQLite, checks the result, fixes its own query when it errors, and answers with a short table plus the final SQL.

## Features

- Schema discovery tools: list tables with row counts, describe columns, foreign keys and sample rows
- Read-only by design: file databases open with `readOnly: true`, the demo store runs with `PRAGMA query_only`, and only a single `SELECT`/`WITH` statement is accepted
- Self-correcting loop on the AI SDK `ToolLoopAgent`
- Built-in demo store (customers, products, orders, order items) so it runs with zero setup
- Uses Node's built-in `node:sqlite`, no database driver to install

## Tech Stack

- **Runtime**: Node.js 22.13+ (24 LTS recommended)
- **Database**: `node:sqlite`
- **AI**: [AI SDK 7](https://ai-sdk.dev) `ToolLoopAgent`, [LLM Gateway provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider)
- **Validation**: Zod 4

## Getting Started

### Prerequisites

- Node.js 22.13+ (24 LTS recommended)
- pnpm
- [LLM Gateway API Key](https://llmgateway.io/dashboard)

### Installation

```bash
# Scaffold it with the CLI
npx @llmgateway/cli init --template sql-agent

# Or from the root of this monorepo
pnpm install
cd agents/sql-agent
```

### Environment

Create `.env.local` (or export the variables in your shell):

```env
LLMGATEWAY_API_KEY=your_api_key_here
# Optional
LLMGATEWAY_MODEL=gpt-6.1-sol
```

## Usage

Build once with `pnpm build`, then run it with `pnpm start`.

```bash
pnpm start                                         # two demo questions on the demo store
pnpm start "Which country has the most refunds?"   # your question on the demo store
pnpm start --db ./analytics.sqlite "Weekly signups for the last 8 weeks"
```

Each tool call is printed as the agent works:

```text
Question: Who are the top 3 customers by total spend, and how many orders did each place?
  → listTables
  → describeTable orders
  → describeTable order_items
  → runQuery
      SELECT c.name, COUNT(DISTINCT o.id) AS orders, SUM(oi.quantity * p.price_cents) / 100.0 AS spend ...
```

## Safety

The agent can only read. Writes fail at the database level, and the `runQuery` tool rejects anything that is not one `SELECT` or `WITH` statement. Point it at a copy or a read replica of production data, and keep personal data out of prompts you would not send to a model provider.

## Enterprise deployments

Set `LLMGATEWAY_GATEWAY_URL` to your inference gateway URL (without `/v1`). Set `LLMGATEWAY_MODEL` to a model allowed by your organization. Keep API keys in server-side environment variables.

## License

MIT
