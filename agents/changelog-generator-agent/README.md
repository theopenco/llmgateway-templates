# Changelog Generator Agent

A command-line AI agent that generates structured changelogs from git history using the [Keep a Changelog](https://keepachangelog.com) format.

## Features

- Analyzes git log and diff history using tools
- Produces Keep a Changelog formatted output (Added, Changed, Fixed, etc.)
- Supports custom revision ranges (e.g., `v1.0.0..v2.0.0`)
- Tool-based agentic architecture with automatic tool loop
- Type-safe with Zod validation

## Tech Stack

- **Runtime**: Node.js 20+ (ES Modules)
- **Language**: TypeScript 5.7
- **AI**: Vercel AI SDK, LLM Gateway Provider
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A git repository to analyze
- [LLM Gateway API Key](https://llmgateway.io)

### Installation

```bash
# From the root of the monorepo
pnpm install

# Or standalone
cd agents/changelog-generator-agent
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
# Generate changelog for recent commits
node dist/index.js

# Generate changelog for a specific range
node dist/index.js v1.0.0..v2.0.0

# Generate changelog for the last 10 commits
node dist/index.js HEAD~10..HEAD
```

## How It Works

1. **User provides** an optional git range
2. **Agent calls tools** to inspect `git log` and `git diff --stat`
3. **LLM analyzes** the commit history and file changes
4. **Produces** a formatted changelog grouped by category

### Available Tools

#### `getGitLog`

Retrieves commit messages, authors, and dates for a revision range.

#### `getGitDiff`

Retrieves a summary of file-level changes (insertions, deletions) for a revision range.

## License

MIT
