# Writing Assistant Template

A full-stack Next.js app for AI-powered text transformation using LLM Gateway.

## Features

- Multiple text actions: rewrite, summarize, expand, fix grammar, change tone
- Tone selector with professional, casual, formal, friendly, persuasive, and academic options
- Apply result to replace original text
- Copy result to clipboard
- Word and character count
- Built with modern React 19 and Next.js 16

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui
- **AI**: Vercel AI SDK (`generateText`), LLM Gateway Provider
- **Icons**: Lucide React

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
cd templates/writing-assistant
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

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
pnpm build
pnpm start
```

## API Reference

### POST /api/assist

Transform text with a specified action.

**Request Body:**

```json
{
  "text": "Your text here",
  "action": "rewrite",
  "tone": "professional"
}
```

**Actions:** `rewrite`, `summarize`, `expand`, `fix-grammar`, `change-tone`

**Response:**

```json
{
  "result": "Transformed text..."
}
```

## License

MIT
