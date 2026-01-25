# LLM Gateway Templates

A collection of open-source templates for building AI-powered applications using [LLM Gateway](https://llmgateway.io) - a unified API gateway for accessing multiple Large Language Models.

## Deploy

### Image Generation App

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftheopenco%2Fopenllm-templates&env=LLMGATEWAY_API_KEY&envDescription=Get%20your%20API%20key%20from%20llmgateway.io&envLink=https%3A%2F%2Fllmgateway.io&project-name=llm-image-generation&repository-name=llm-image-generation&root-directory=templates/image-generation)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/llm-image-generation?referralCode=llmgateway)

## Templates

| Template | Description | Stack |
|----------|-------------|-------|
| [Image Generation](./templates/image-generation) | Full-stack web app for AI image generation | Next.js 16, React 19, Tailwind CSS |
| [Weather Agent](./agents/weather-agent) | CLI agent that answers weather queries using tools | Node.js, TypeScript, Vercel AI SDK |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.15+
- [LLM Gateway API Key](https://llmgateway.io)

### Installation

```bash
# Clone the repository
git clone https://github.com/theopenco/openllm-templates.git
cd openllm-templates

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
openllm-templates/
├── templates/
│   └── image-generation/    # Next.js image generation app
├── agents/
│   └── weather-agent/       # CLI weather agent
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

- [GitHub Issues](https://github.com/theopenco/openllm-templates/issues)
- [LLM Gateway Discord](https://discord.gg/llmgateway)
