# Data Extractor Agent

A command-line AI agent that extracts structured entities (people, organizations, dates, monetary amounts, and more) from unstructured text.

## Features

- Extracts people, organizations, dates, monetary amounts, locations, emails, and phone numbers
- Handles unstructured text of any length
- Type-safe structured output with Zod schema validation
- Clean categorized output

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
cd agents/data-extractor-agent
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
# Extract entities from text
node dist/index.js "John Smith from Acme Corp signed a $50k deal on Jan 15"

# Extract contact information
node dist/index.js "Contact jane@example.com or call 555-0123 for details"

# Show help
node dist/index.js --help
```

## Entity Types

The agent extracts the following entity types:

- **People**: Names of individuals
- **Organizations**: Companies, institutions, groups
- **Dates**: Dates and time references
- **Monetary Amounts**: Money values with currency
- **Locations**: Cities, countries, addresses
- **Emails**: Email addresses
- **Phone Numbers**: Phone numbers

## License

MIT
