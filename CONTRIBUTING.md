# Contributing to LLM Gateway Templates

Thank you for your interest in contributing! This document provides guidelines and steps for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/theopenco/openllm-templates/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)

### Suggesting Features

1. Open a [GitHub Issue](https://github.com/theopenco/openllm-templates/issues/new)
2. Describe the feature and its use case
3. Explain why it would benefit the community

### Submitting Changes

1. **Fork the repository**

2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/openllm-templates.git
   cd openllm-templates
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Make your changes**
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation as needed

6. **Run checks**
   ```bash
   pnpm lint
   pnpm build
   ```

7. **Commit your changes**
   ```bash
   git commit -m "Add: description of your changes"
   ```

8. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

9. **Open a Pull Request**
   - Provide a clear description of changes
   - Reference any related issues

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9.15+
- LLM Gateway API Key (get one at [llmgateway.io](https://llmgateway.io))

### Running Locally

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp templates/image-generation/.env.example templates/image-generation/.env.local
cp agents/weather-agent/.env.example agents/weather-agent/.env.local
# Edit .env.local files with your API key

# Run all templates
pnpm dev

# Or run specific template
cd templates/image-generation && pnpm dev
```

## Adding a New Template

1. Create a new directory under `templates/` or `agents/`
2. Add a `package.json` with the naming convention `@llmgateway-templates/your-template-name`
3. Include an `.env.example` file
4. Add a comprehensive `README.md`
5. Update the root `README.md` to include your template
6. Update `pnpm-workspace.yaml` if needed

### Template Requirements

- Must use `@llmgateway/ai-sdk-provider` for AI functionality
- Include clear setup instructions
- Provide example usage
- Follow existing code style and patterns

## Code Style

- Use TypeScript for type safety
- Follow existing formatting (Prettier)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Commit Messages

Use clear, descriptive commit messages:

- `Add: new feature description`
- `Fix: bug description`
- `Update: what was updated`
- `Docs: documentation changes`
- `Refactor: code refactoring`

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include screenshots for UI changes
- Ensure all checks pass
- Respond to review feedback promptly

## Questions?

- Open a [GitHub Discussion](https://github.com/theopenco/openllm-templates/discussions)
- Join our [Discord](https://discord.gg/llmgateway)

Thank you for contributing!
