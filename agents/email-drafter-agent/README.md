# Email Drafter Agent

A command-line AI agent that drafts polished emails from rough notes or bullet points, with configurable tone.

## Features

- Transforms bullet points into professional emails
- Structured output with subject, body, and sign-off
- Configurable tone via `--tone` flag (formal, casual, professional, friendly, etc.)
- Type-safe structured output with Zod schema validation

## Tech Stack

- **Runtime**: Node.js 20+ (ES Modules)
- **Language**: TypeScript 5.7
- **AI**: Vercel AI SDK, LLM Gateway Provider
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
cd agents/email-drafter-agent
pnpm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API key:

```env
LLMGATEWAY_API_KEY=your_api_key_here
```

### Development

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
pnpm start
```

## Usage

```bash
# Default professional tone
node dist/index.js "meeting tomorrow at 3pm, need to reschedule to Friday"

# Formal tone
node dist/index.js "thank client for contract, next steps onboarding" --tone formal

# Casual tone
node dist/index.js "team lunch Friday, bring ideas for venue" --tone casual

# Show help
node dist/index.js --help
```

## Output Format

The agent returns a structured email with three fields:

- **Subject**: A concise email subject line
- **Body**: The full email body text
- **Sign-off**: An appropriate closing line

## License

MIT
