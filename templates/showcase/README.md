# Showcase

A public gallery of apps built with [LLM Gateway](https://llmgateway.io)
templates. It is a fully static Next.js site — no API key required to run it —
designed to be forked and self-hosted, or used as the upstream community
directory.

```bash
npx @llmgateway/cli init --template showcase
```

## Why it exists

Every app a developer ships on a template is proof that LLM Gateway works. The
Showcase collects that proof in one browsable, filterable index — inspiration
for new builders and a distribution surface for the people who ship.

## How entries work

- The gallery seeds itself from the official templates in this repo, so it is
  never empty.
- Community apps are added to [`src/lib/showcase.ts`](./src/lib/showcase.ts) —
  one typed entry each — via pull request.
- The **Submit your app** button opens a pre-filled GitHub issue
  ([template](../../.github/ISSUE_TEMPLATE/showcase-submission.yml)); a
  maintainer turns approved submissions into entries.

Each entry is just:

```ts
{
  slug: "my-app",
  name: "My App",
  tagline: "What it does, in one line.",
  url: "https://my-app.com",
  author: "Your Name",
  template: "ai-chatbot",
  tags: ["chat", "saas"],
  type: "community",
}
```

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Make it yours

- Point submissions at your own fork by setting `NEXT_PUBLIC_SHOWCASE_REPO` in
  `.env.local` (e.g. `your-org/your-repo`).
- The footer uses a self-contained [`<PoweredBy>`](./src/components/powered-by.tsx)
  badge — copy that file into any app to add the attribution link.
