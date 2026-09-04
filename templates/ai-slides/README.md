# AI Slides

Build and edit presentations with AI-assisted research, slide writing, image generation, and charts. Export a presentation to PowerPoint.

## Run locally

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Set `LLMGATEWAY_API_KEY` in `.env.local`, or enter your key in the app. Open http://localhost:3000, choose models in the AI Tools panel, and generate or edit a presentation. The app uses Next.js 16, React 19, and AI SDK 6 with the LLM Gateway provider.

## Enterprise deployments

Set `LLMGATEWAY_GATEWAY_URL` to your inference gateway URL without `/v1`. Model discovery and generation use that deployment. Keep the API key in server-side environment variables.

## Validation

```bash
pnpm lint
pnpm build
```
