"use client";

import {
  BuyCredits,
  Chat,
  CreditBalance,
  LLMGatewayProvider,
  useBalance,
  type SessionRef,
} from "@llmgateway/elements";
import { useEffect, useState } from "react";

const MODEL = "openai/gpt-4o-mini";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const apiBaseUrl = process.env.NEXT_PUBLIC_LLMGATEWAY_API_URL;
const gatewayBaseUrl = process.env.NEXT_PUBLIC_LLMGATEWAY_GATEWAY_URL;

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
  const [session, setSession] = useState<SessionRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <main className="page">Error: {error}</main>;
  }
  if (!session) {
    return <main className="page">Starting session…</main>;
  }

  return (
    <main className="page">
      <h1>AI credits, in your app</h1>
      <p>
        Your end-users buy credits and chat with AI — billed to their own wallet
        through LLM Gateway.
      </p>
      <LLMGatewayProvider
        session={session}
        stripePublishableKey={stripePublishableKey}
        apiBaseUrl={apiBaseUrl}
        gatewayBaseUrl={gatewayBaseUrl}
        fetchSession={fetchSession}
        appearance={{ theme: "light" }}
      >
        <Dashboard />
      </LLMGatewayProvider>
    </main>
  );
}

function Dashboard() {
  const { refetchUntilChange } = useBalance();
  const [showBuy, setShowBuy] = useState(false);

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <CreditBalance label="Your balance" />
          <button onClick={() => setShowBuy((v) => !v)}>
            {showBuy ? "Close" : "Buy credits"}
          </button>
        </div>
        {showBuy ? (
          <BuyCredits
            amount={10}
            onSuccess={() => {
              // The wallet is credited asynchronously once the webhook lands —
              // poll until the balance reflects it.
              setShowBuy(false);
              void refetchUntilChange();
            }}
          />
        ) : null}
      </div>

      {/* Each reply streams from the gateway and debits the wallet; the debit is
          applied by the worker after the turn, so poll until it lands. */}
      <Chat model={MODEL} onFinish={() => void refetchUntilChange()} />
    </>
  );
}
