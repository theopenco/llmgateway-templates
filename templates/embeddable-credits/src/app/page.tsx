"use client";

import {
  BuyCredits,
  Chat,
  CreditBalance,
  LLMGatewayProvider,
  PoweredBy,
  useBalance,
  type SessionRef,
} from "@llmgateway/elements";
import { useEffect, useState } from "react";

const MODEL = "openai/gpt-4o-mini";
const REPO = "https://github.com/theopenco/llmgateway-templates";

const apiBaseUrl = process.env.NEXT_PUBLIC_LLMGATEWAY_API_URL;
const gatewayBaseUrl = process.env.NEXT_PUBLIC_LLMGATEWAY_GATEWAY_URL;

/** The widgets render dark to match the page. */
const DEMO_APPEARANCE = {
  theme: "dark" as const,
  variables: {
    "--lg-color-primary": "#a98bff",
    "--lg-color-text": "#ececf1",
    "--lg-color-muted": "#9a9aa7",
    "--lg-color-bg": "#121216",
    "--lg-color-border": "rgba(255,255,255,0.10)",
  },
};

/** Calls our backend, which mints a session with the secret key. */
async function fetchSession(): Promise<SessionRef> {
  const res = await fetch("/api/llmgateway/session", { method: "POST" });
  if (!res.ok) {
    throw new Error("Failed to mint session");
  }
  const data = await res.json();
  return { token: data.sessionToken, expiresAt: data.expiresAt };
}

export default function Page() {
  return (
    <main className="shell">
      <Backdrop />
      <TopBar />
      <Hero />
      <HowItWorks />
      <Integration />
      <Footer />
    </main>
  );
}

function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__grid" />
      <div className="backdrop__glow" />
    </div>
  );
}

function TopBar() {
  return (
    <header className="topbar">
      <a className="brand" href={REPO} target="_blank" rel="noreferrer">
        <span className="brand__mark">◇</span>
        <span className="brand__name">LLM Gateway</span>
        <span className="brand__tag">/ embeddable wallets</span>
      </a>
      <nav className="topbar__nav">
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a
          className="topbar__cta"
          href="https://llmgateway.io?utm_source=template&utm_medium=embeddable-credits&utm_campaign=topbar"
          target="_blank"
          rel="noreferrer"
        >
          Get a key →
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero__copy">
        <p className="eyebrow">
          <span className="dot" /> STRIPE FOR AI · END-USER WALLETS
        </p>
        <h1 className="hero__title">
          Charge your users for AI.
          <br />
          <span className="hero__accent">In five minutes.</span>
        </h1>
        <p className="hero__sub">
          Drop in three React components and one backend route. Your end-users
          buy credits and use AI billed to <em>their own</em> wallet — you keep
          your margin and never front their token spend.
        </p>
        <div className="hero__actions">
          <a
            className="btn btn--primary"
            href="https://llmgateway.io?utm_source=template&utm_medium=embeddable-credits&utm_campaign=hero"
            target="_blank"
            rel="noreferrer"
          >
            Start free
          </a>
          <a className="btn btn--ghost" href={REPO} target="_blank" rel="noreferrer">
            View the source
          </a>
        </div>
        <ul className="hero__facts">
          <li>
            <strong>3</strong> components
          </li>
          <li>
            <strong>1</strong> backend route
          </li>
          <li>
            <strong>0</strong> tokens you pay for
          </li>
        </ul>
      </div>

      <div className="hero__demo">
        <div className="device" role="group" aria-label="Live demo">
          <div className="device__bar">
            <span className="device__dots">
              <i />
              <i />
              <i />
            </span>
            <span className="device__url">your-app.com</span>
            <span className="device__live">
              <span className="device__live-dot" /> live
            </span>
          </div>
          <div className="device__body">
            <LiveDemo />
          </div>
        </div>
        <p className="hero__demo-note">
          Real widgets from <code>@llmgateway/elements</code>, running right here.
        </p>
      </div>
    </section>
  );
}

function LiveDemo() {
  const [session, setSession] = useState<SessionRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <NeedsKeys />;
  }
  if (!session) {
    return (
      <div className="demo-state">
        <span className="spinner" /> Booting wallet…
      </div>
    );
  }

  return (
    <LLMGatewayProvider
      session={session}
      apiBaseUrl={apiBaseUrl}
      gatewayBaseUrl={gatewayBaseUrl}
      fetchSession={fetchSession}
      appearance={DEMO_APPEARANCE}
    >
      <Dashboard />
    </LLMGatewayProvider>
  );
}

function Dashboard() {
  const { refetchUntilChange } = useBalance();
  const [showBuy, setShowBuy] = useState(false);

  return (
    <div className="wallet">
      <div className="wallet__head">
        <CreditBalance label="Wallet balance">
          {({ balance, currency, loading }) => (
            <div className="wallet__balance">
              <span className="wallet__balance-label">Wallet balance</span>
              <span className="wallet__balance-value">
                {loading
                  ? "—"
                  : `${currency === "USD" || !currency ? "$" : ""}${
                      balance == null ? "0.00" : Number(balance).toFixed(2)
                    }`}
              </span>
            </div>
          )}
        </CreditBalance>
        <button className="wallet__buy" onClick={() => setShowBuy((v) => !v)}>
          {showBuy ? "Close" : "+ Add credits"}
        </button>
      </div>

      {showBuy ? (
        <BuyCredits
          amount={10}
          buttonLabel="Pay $10"
          onSuccess={() => {
            setShowBuy(false);
            void refetchUntilChange();
          }}
        />
      ) : null}

      <Chat
        model={MODEL}
        placeholder="Ask the AI — it debits the wallet…"
        onFinish={() => void refetchUntilChange()}
      />
    </div>
  );
}

function NeedsKeys() {
  return (
    <div className="needs-keys">
      <p className="needs-keys__title">Add your keys to go live</p>
      <p className="needs-keys__body">
        Set <code>LLMGATEWAY_SECRET_KEY</code> in <code>.env.local</code> and
        this panel turns into a working wallet + AI chat.
      </p>
      <a
        className="btn btn--primary btn--sm"
        href="https://llmgateway.io?utm_source=template&utm_medium=embeddable-credits&utm_campaign=needs-keys"
        target="_blank"
        rel="noreferrer"
      >
        Get a secret key →
      </a>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Mint a session",
    body: "Your backend exchanges its secret key for a short-lived end-user session token.",
  },
  {
    n: "02",
    title: "Drop in the widgets",
    body: "<CreditBalance>, <BuyCredits> and a chat — wrapped in <LLMGatewayProvider>.",
  },
  {
    n: "03",
    title: "Users pay & use AI",
    body: "Top-ups hit their wallet via Stripe; every AI call debits it. You front nothing.",
  },
];

function HowItWorks() {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">Three moving parts</h2>
        <p className="section__lead">
          The browser only ever holds a publishable key and a short-lived
          session token — your secret key never leaves the server.
        </p>
      </div>

      <ol className="steps">
        {STEPS.map((s) => (
          <li className="step" key={s.n}>
            <span className="step__n">{s.n}</span>
            <h3 className="step__title">{s.title}</h3>
            <p className="step__body">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="wiring" aria-hidden="true">
        <div className="wiring__node">
          <span className="wiring__label">Browser</span>
          <span className="wiring__sub">@llmgateway/elements</span>
        </div>
        <div className="wiring__line">
          <span>session token</span>
        </div>
        <div className="wiring__node">
          <span className="wiring__label">Your backend</span>
          <span className="wiring__sub">@llmgateway/server · secret key</span>
        </div>
        <div className="wiring__line">
          <span>mint · top-up · chat</span>
        </div>
        <div className="wiring__node wiring__node--accent">
          <span className="wiring__label">LLM Gateway</span>
          <span className="wiring__sub">wallets · Stripe · 100+ models</span>
        </div>
      </div>
    </section>
  );
}

const SNIPPETS: { file: string; code: string }[] = [
  {
    file: "app/api/llmgateway/session/route.ts",
    code: `const lg = new LLMGateway({ secretKey });

export async function POST() {
  return Response.json(
    await lg.sessions.create({
      customer: { externalId: user.id },
      scope: { models: ["openai/gpt-4o-mini"] },
    }),
  );
}`,
  },
  {
    file: "app/page.tsx",
    code: `<LLMGatewayProvider session={session} fetchSession={fetchSession}>
  <CreditBalance label="Balance" />
  <BuyCredits amount={10} />
  <Chat model="openai/gpt-4o-mini" />
</LLMGatewayProvider>`,
  },
];

function Integration() {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">The whole integration</h2>
        <p className="section__lead">
          That is essentially all of it. Copy these two files and you have a
          billed AI product.
        </p>
      </div>
      <div className="code-grid">
        {SNIPPETS.map((s) => (
          <figure className="code" key={s.file}>
            <figcaption className="code__file">{s.file}</figcaption>
            <pre className="code__pre">
              <code>{s.code}</code>
            </pre>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__cta">
        <h2 className="footer__title">Ship a paid AI app today.</h2>
        <a
          className="btn btn--primary"
          href="https://llmgateway.io?utm_source=template&utm_medium=embeddable-credits&utm_campaign=footer"
          target="_blank"
          rel="noreferrer"
        >
          Create your account
        </a>
      </div>
      <div className="footer__meta">
        <span>MIT licensed · clone, ship, keep the margin</span>
        <PoweredBy theme="dark" campaign="embeddable-credits" />
      </div>
    </footer>
  );
}
