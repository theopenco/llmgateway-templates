import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";

import { useLLMGateway } from "./context.js";
import { PoweredBy } from "./PoweredBy.js";
import type { TopUp } from "@llmgateway/client";

export interface BuyCreditsProps {
  /** Credits (USD) to add. The end-user is charged this plus platform fees. */
  amount: number;
  /** Called after the payment is confirmed client-side. */
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  buttonLabel?: string;
  /**
   * Show the "Powered by LLM Gateway" attribution under the pay button.
   * @default true
   */
  poweredBy?: boolean;
}

// Cache loadStripe per publishable key (Stripe.js must load once).
const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(key: string): Promise<Stripe | null> {
  let p = stripeCache.get(key);
  if (!p) {
    p = loadStripe(key);
    stripeCache.set(key, p);
  }
  return p;
}

/**
 * Drop-in credit purchase widget. Creates a top-up PaymentIntent scoped to the
 * end-user wallet, renders Stripe's PaymentElement, and confirms the payment.
 * The wallet is credited once LLM Gateway's webhook processes the payment.
 */
export function BuyCredits(props: BuyCreditsProps) {
  const { stripePublishableKey, appearance } = useLLMGateway();
  const stripePromise = useMemo(
    () =>
      stripePublishableKey ? getStripePromise(stripePublishableKey) : null,
    [stripePublishableKey],
  );
  if (
    !Number.isInteger(props.amount) ||
    props.amount < 10 ||
    props.amount > 5000
  ) {
    return (
      <div className="lg-buy-credits lg-buy-credits--error" role="alert">
        Credit amount must be a whole dollar between $10 and $5,000.
      </div>
    );
  }
  if (!stripePromise)
    return (
      <div className="lg-buy-credits lg-buy-credits--loading">Loading…</div>
    );
  return (
    <Elements
      key={`${stripePublishableKey}:${props.amount}`}
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: props.amount * 105,
        currency: "usd",
        paymentMethodTypes: ["card"],
        paymentMethodCreation: "manual",
        appearance: {
          theme: appearance?.theme === "dark" ? "night" : "stripe",
        },
      }}
    >
      <CheckoutForm
        {...props}
        poweredBy={props.poweredBy ?? true}
        theme={appearance?.theme}
      />
    </Elements>
  );
}

function CheckoutForm(
  props: BuyCreditsProps & { poweredBy: boolean; theme?: "light" | "dark" },
) {
  const { amount, buttonLabel, poweredBy, theme, onSuccess, onError } = props;
  const { client } = useLLMGateway();
  const stripe = useStripe();
  const elements = useElements();
  const [quote, setQuote] = useState<TopUp | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting || complete) return;
    setSubmitting(true);
    setMessage(null);
    try {
      if (!quote) {
        const submitted = await elements.submit();
        if (submitted.error)
          throw new Error(submitted.error.message ?? "Check your card details");
        const method = await stripe.createPaymentMethod({ elements });
        if (method.error)
          throw new Error(
            method.error.message ?? "Could not read card details",
          );
        setQuote(await client.createTopUp(amount, method.paymentMethod.id));
        return;
      }
      let result = await client.confirmTopUp(quote.paymentIntentId);
      if (result.status === "requires_action") {
        const action = await stripe.handleNextAction({
          clientSecret: result.clientSecret,
        });
        if (action.error)
          throw new Error(action.error.message ?? "Card authentication failed");
        result = await client.confirmTopUp(quote.paymentIntentId);
      }
      if (result.status !== "succeeded" && result.status !== "processing") {
        if (
          result.status === "requires_payment_method" ||
          result.status === "canceled"
        )
          setQuote(null);
        throw new Error(
          "Payment was not completed. Check your card and try again.",
        );
      }
      setComplete(true);
      onSuccess?.();
    } catch (error: unknown) {
      const failure = error instanceof Error ? error : new Error(String(error));
      setMessage(failure.message);
      onError?.(failure);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lg-buy-credits" onSubmit={handleSubmit}>
      <div hidden={!!quote || complete}>
        <PaymentElement />
      </div>
      {quote && !complete ? (
        <>
          <dl className="lg-buy-credits__fees" aria-label="Payment breakdown">
            <div>
              <dt>Credits</dt>
              <dd>${amount.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Platform fee (5%)</dt>
              <dd>${quote.platformFee.toFixed(2)}</dd>
            </div>
            {quote.internationalFee > 0 ? (
              <div>
                <dt>International card fee (1.5%)</dt>
                <dd>${quote.internationalFee.toFixed(2)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Total</dt>
              <dd>${quote.totalAmount.toFixed(2)}</dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setQuote(null)}
          >
            Change card
          </button>
        </>
      ) : null}
      {complete ? (
        <div role="status">Payment submitted</div>
      ) : (
        <button
          className="lg-buy-credits__submit"
          type="submit"
          disabled={!stripe || !elements || submitting}
        >
          {submitting
            ? "Processing…"
            : quote
              ? `Pay $${quote.totalAmount.toFixed(2)}`
              : (buttonLabel ?? "Review payment")}
        </button>
      )}
      {message ? (
        <div className="lg-buy-credits__error" role="alert">
          {message}
        </div>
      ) : null}
      {poweredBy ? (
        <div className="lg-buy-credits__powered-by">
          <PoweredBy
            variant="inline"
            theme={theme ?? "auto"}
            campaign="embeddable-checkout"
          />
        </div>
      ) : null}
    </form>
  );
}
