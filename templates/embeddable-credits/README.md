# Monetize your AI app in 5 minutes

The flagship **"Stripe for AI"** template. A polished Next.js app that lets
**your end-users** buy AI credits and use AI in-app, billed to _their own_
wallet through [LLM Gateway](https://llmgateway.io) — so you keep your margin and
never front their token spend.

Drop in three React components and one backend route. The landing page is a real,
live demo: it boots a wallet, takes a Stripe top-up, and streams a chat that
debits the balance.

```bash
npx @llmgateway/cli init --template embeddable-credits
```

It uses the three embeddable SDK packages:

| Package                | Where it runs             | Purpose                                         |
| ---------------------- | ------------------------- | ----------------------------------------------- |
| `@llmgateway/server`   | Your backend (secret key) | Mint ephemeral end-user **session tokens**      |
| `@llmgateway/elements` | Browser (React)           | `<BuyCredits>`, `<CreditBalance>`, `useBalance` |
| `@llmgateway/client`   | Browser (headless)        | Stream chat with the session token              |

## How it works

```
Browser                         Your backend                LLM Gateway
  │  POST /api/llmgateway/session ─▶ server SDK: sessions.create ─▶ mint es_ token
  │  ◀────────── { sessionToken } ──
  │  <LLMGatewayProvider session=…>
  │     <CreditBalance/>  ── GET  /v1/wallet/balance (es_) ───────▶ wallet balance
  │     <BuyCredits/>     ── POST /v1/wallet/top-up   (es_) ───────▶ Stripe PaymentIntent
  │                          confirm card in <PaymentElement>  ──▶ webhook credits wallet
  │     client.stream()   ── POST /v1/chat/completions (es_) ─────▶ AI; debits wallet
```

The browser only ever holds the short-lived `es_` session token and a publishable
key — never your secret key.

## Setup

1. In the LLM Gateway dashboard, create a project, **enable end-user sessions**,
   and create a **platform secret** API key (`sk_…`).
2. Copy `.env.example` to `.env.local` and fill in:
   - `LLMGATEWAY_SECRET_KEY` — your `sk_…` (server-only)
3. Install and run:

   ```bash
   pnpm install
   pnpm dev
   ```

Open http://localhost:3000 — you'll get a session automatically, can stream a
chat completion (debits the wallet), and buy credits via Stripe.

## Production notes

- Replace the hard-coded `externalId` in `src/app/api/llmgateway/session/route.ts`
  with your authenticated user's stable id so each user keeps their wallet.
- `fetchSession` is wired as the provider's refresh hook, so expired session
  tokens are renewed transparently.
- `<BuyCredits>` renders a "Powered by LLM Gateway" line under the pay button by
  default — pass `poweredBy={false}` to remove it. The footer uses the standalone
  [`<PoweredBy>`](../../packages/elements/src/PoweredBy.tsx) badge, which you can
  drop into any app:

  ```tsx
  import { PoweredBy } from "@llmgateway/elements";

  <PoweredBy campaign="my-app" theme="dark" />;
  ```

Built something with this template? [Add it to the Showcase](../showcase) so
other developers can find it.
