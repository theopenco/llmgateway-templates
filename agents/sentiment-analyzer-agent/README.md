# Sentiment Analyzer Agent

A command-line AI agent that analyzes the sentiment of text, returning structured results with confidence scores and key phrases.

## Features

- Classifies text as positive, negative, neutral, or mixed
- Provides confidence scores (0-100%)
- Extracts key phrases that influenced the analysis
- Supports direct text input or file paths (.txt, .md)
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
cd agents/sentiment-analyzer-agent
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
# Analyze text directly
node dist/index.js "I love this product, it works great!"

# Analyze a text file
node dist/index.js review.txt

# Analyze a markdown file
node dist/index.js feedback.md
```

## Output Format

The agent returns structured analysis with:

- **Sentiment**: positive, negative, neutral, or mixed
- **Confidence**: Score from 0-100%
- **Key Phrases**: Phrases that influenced the analysis
- **Summary**: Brief explanation of the sentiment

## License

MIT
