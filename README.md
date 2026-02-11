# LLM Gateway Templates

A collection of open-source templates for building AI-powered applications using [LLM Gateway](https://llmgateway.io) - a unified API gateway for accessing multiple Large Language Models.

## Deploy

### Image Generation App

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftheopenco%2Fllmgateway-templates&env=LLMGATEWAY_API_KEY&envDescription=Get%20your%20API%20key%20from%20llmgateway.io&envLink=https%3A%2F%2Fllmgateway.io&project-name=llm-image-generation&repository-name=llm-image-generation&root-directory=templates/image-generation)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/llm-image-generation?referralCode=llmgateway)

## Templates

| Template | Description | Stack |
|----------|-------------|-------|
| [Image Generation](./templates/image-generation) | Full-stack web app for AI image generation | Next.js 16, React 19, Tailwind CSS |
| [AI Chatbot](./templates/ai-chatbot) | Streaming chat with conversation history and model selector | Next.js 16, React 19, Tailwind CSS |
| [OG Image Generator](./templates/og-image-generator) | AI-powered Open Graph image generator with preview and download | Next.js 16, React 19, Tailwind CSS |
| [Feedback Dashboard](./templates/feedback-dashboard) | Customer feedback sentiment analysis dashboard | Next.js 16, React 19, Tailwind CSS |
| [Writing Assistant](./templates/writing-assistant) | AI writing assistant with text actions (rewrite, summarize, expand) | Next.js 16, React 19, Tailwind CSS |
| [Weather Agent](./agents/weather-agent) | CLI agent that answers weather queries using tools | Node.js, TypeScript, Vercel AI SDK |
| [Lead Agent](./agents/lead-agent) | CLI agent that researches people and posts to Discord | Node.js, TypeScript, Vercel AI SDK |
| [Changelog Generator](./agents/changelog-generator-agent) | CLI agent that generates changelogs from git history | Node.js, TypeScript, Vercel AI SDK |
| [Email Drafter](./agents/email-drafter-agent) | CLI agent that drafts polished emails from notes | Node.js, TypeScript, Vercel AI SDK |
| [Sentiment Analyzer](./agents/sentiment-analyzer-agent) | CLI agent that analyzes text sentiment | Node.js, TypeScript, Vercel AI SDK |
| [Data Extractor](./agents/data-extractor-agent) | CLI agent that extracts structured entities from text | Node.js, TypeScript, Vercel AI SDK |

## Quick Start

The easiest way to get started is with the CLI:

```bash
# Create a new project (interactive)
npx @llmgateway/cli init

# Or specify a template directly
npx @llmgateway/cli init --template image-generation
npx @llmgateway/cli init --template weather-agent
```

## CLI

The `@llmgateway/cli` provides tools for scaffolding templates and managing AI projects:

```bash
npx @llmgateway/cli init              # Create a new project from a template
npx @llmgateway/cli list              # List available templates
npx @llmgateway/cli models            # Browse available AI models
npx @llmgateway/cli add tool weather  # Add tools to your project
npx @llmgateway/cli auth login        # Manage your API key
npx @llmgateway/cli docs              # Open documentation
```

See the [CLI documentation](./packages/llmgateway-cli/README.md) for all available commands.

## Getting Started (Manual)

### Prerequisites

- Node.js 20+
- pnpm 9.15+
- [LLM Gateway API Key](https://llmgateway.io)

### Installation

```bash
# Clone the repository
git clone https://github.com/theopenco/llmgateway-templates.git
cd llmgateway-templates

# Install dependencies
pnpm install

# Copy environment variables
cp templates/image-generation/.env.example templates/image-generation/.env.local
cp agents/weather-agent/.env.example agents/weather-agent/.env.local

# Add your API key to the .env.local files
```

### Development

```bash
# Run all templates in development mode
pnpm dev

# Or run a specific template
cd templates/image-generation && pnpm dev
cd agents/weather-agent && pnpm dev
```

### Build

```bash
# Build all templates
pnpm build
```

## Project Structure

```
llmgateway-templates/
├── packages/
│   └── llmgateway-cli/      # @llmgateway/cli package
├── templates/
│   ├── image-generation/    # Next.js image generation app
│   ├── ai-chatbot/          # Next.js streaming chatbot
│   ├── og-image-generator/  # Next.js OG image generator
│   ├── feedback-dashboard/  # Next.js sentiment dashboard
│   └── writing-assistant/   # Next.js writing assistant
├── agents/
│   ├── weather-agent/              # CLI weather agent
│   ├── lead-agent/                 # CLI lead research agent
│   ├── changelog-generator-agent/  # CLI changelog generator
│   ├── email-drafter-agent/        # CLI email drafter
│   ├── sentiment-analyzer-agent/   # CLI sentiment analyzer
│   └── data-extractor-agent/       # CLI data extractor
├── package.json             # Root workspace config
├── pnpm-workspace.yaml      # pnpm workspace config
└── turbo.json               # Turbo build config
```

## Tech Stack

- **AI SDK**: [Vercel AI SDK](https://ai-sdk.dev) with [@llmgateway/ai-sdk-provider](https://www.npmjs.com/package/@llmgateway/ai-sdk-provider)
- **Package Manager**: pnpm
- **Monorepo**: Turborepo
- **Runtime**: Node.js 20+

## Documentation

- [LLM Gateway Docs](https://docs.llmgateway.io)
- [Vercel AI SDK Docs](https://ai-sdk.dev)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/theopenco/llmgateway-templates/issues)
- [LLM Gateway Discord](https://discord.gg/llmgateway)
