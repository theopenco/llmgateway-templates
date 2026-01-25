# @llmgateway/cli

CLI tool for scaffolding LLM Gateway templates and managing AI projects.

## Installation

```bash
# Use directly with npx (recommended)
npx @llmgateway/cli init

# Or install globally
npm install -g @llmgateway/cli
```

## Commands

### `init` - Create a new project

```bash
# Interactive mode
npx @llmgateway/cli init

# Specify template
npx @llmgateway/cli init --template image-generation

# Specify template and directory
npx @llmgateway/cli init --template weather-agent ./my-agent

# Specify project name
npx @llmgateway/cli init --template image-generation --name my-app
```

### `list` - Show available templates

```bash
npx @llmgateway/cli list
npx @llmgateway/cli list --json
```

### `models` - Browse available models

```bash
# List all models
npx @llmgateway/cli models

# Filter by capability
npx @llmgateway/cli models --capability image

# Filter by provider
npx @llmgateway/cli models --provider openai

# Search by name
npx @llmgateway/cli models --search gpt
```

### `add` - Add tools or routes to your project

```bash
# Interactive mode
npx @llmgateway/cli add

# Add a specific tool
npx @llmgateway/cli add tool weather
npx @llmgateway/cli add tool search
npx @llmgateway/cli add tool calculator

# Add an API route
npx @llmgateway/cli add route generate
npx @llmgateway/cli add route chat
```

### `auth` - Manage API key

```bash
# Login (opens browser to get API key)
npx @llmgateway/cli auth login

# Check authentication status
npx @llmgateway/cli auth status

# Logout (remove stored key)
npx @llmgateway/cli auth logout
```

### `dev` - Start development server

```bash
npx @llmgateway/cli dev
npx @llmgateway/cli dev --port 3001
```

### `upgrade` - Upgrade @llmgateway packages

```bash
# Upgrade packages
npx @llmgateway/cli upgrade

# Check for updates without installing
npx @llmgateway/cli upgrade --check
```

### `docs` - Open documentation

```bash
# Open main docs
npx @llmgateway/cli docs

# Open specific topic
npx @llmgateway/cli docs models
npx @llmgateway/cli docs api
npx @llmgateway/cli docs sdk
```

## Available Templates

| Template | Description | Type |
|----------|-------------|------|
| `image-generation` | Full-stack AI image generation app (Next.js 16, React 19) | Web |
| `weather-agent` | CLI agent that answers weather queries using tools | Agent |

## Configuration

The CLI stores configuration in `~/.llmgateway/config.json`:

```json
{
  "apiKey": "your-api-key",
  "defaultTemplate": "image-generation"
}
```

Environment variables take precedence over the config file:

- `LLMGATEWAY_API_KEY` - Your LLM Gateway API key

## License

MIT
