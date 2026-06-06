import {
	Elements,
	PaymentElement,
	useElements,
	useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";

import { useLLMGateway } from "./context.js";

export interface BuyCreditsProps {
	/** Credits (USD) to add. The end-user is charged this plus platform fees. */
	amount: number;
	/** Called after the payment is confirmed client-side. */
	onSuccess?: () => void;
	onError?: (error: Error) => void;
	buttonLabel?: string;
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
	const { amount, onSuccess, onError, buttonLabel } = props;
	const { client, stripePublishableKey: providedKey, appearance } =
		useLLMGateway();

	const [clientSecret, setClientSecret] = useState<string | null>(null);
	const [error, setError] = useState<Error | null>(null);
	// Fall back to LLM Gateway's publishable key from /v1/config when the host
	// didn't pass one to the provider.
	const [fetchedKey, setFetchedKey] = useState<string | null>(null);
	const [configChecked, setConfigChecked] = useState(false);
	const stripePublishableKey = providedKey ?? fetchedKey ?? undefined;

	useEffect(() => {
		if (providedKey) {
			return;
		}
		let cancelled = false;
		client
			.getConfig()
			.then((cfg) => {
				if (!cancelled) {
					setFetchedKey(cfg.stripePublishableKey);
				}
			})
			.catch(() => {
				/* surfaced below as the missing-key message */
			})
			.finally(() => {
				if (!cancelled) {
					setConfigChecked(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [client, providedKey]);

	useEffect(() => {
		let cancelled = false;
		setError(null);
		setClientSecret(null);
		client
			.createTopUp(amount)
			.then((res) => {
				if (!cancelled) {
					setClientSecret(res.clientSecret);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					const e = err instanceof Error ? err : new Error(String(err));
					setError(e);
					onError?.(e);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [client, amount, onError]);

	const stripePromise = useMemo(
		() => (stripePublishableKey ? getStripePromise(stripePublishableKey) : null),
		[stripePublishableKey],
	);

	if (!stripePublishableKey) {
		// Still resolving the key from /v1/config.
		if (!providedKey && !configChecked) {
			return (
				<div className="lg-buy-credits lg-buy-credits--loading">Loading…</div>
			);
		}
		return (
			<div className="lg-buy-credits lg-buy-credits--error">
				No Stripe publishable key available. Pass `stripePublishableKey` to
				&lt;LLMGatewayProvider&gt; or configure it on LLM Gateway.
			</div>
		);
	}

	if (error) {
		return (
			<div className="lg-buy-credits lg-buy-credits--error">
				{error.message}
			</div>
		);
	}

	if (!clientSecret || !stripePromise) {
		return <div className="lg-buy-credits lg-buy-credits--loading">Loading…</div>;
	}

	return (
		<Elements
			stripe={stripePromise}
			options={{
				clientSecret,
				appearance: { theme: appearance?.theme === "dark" ? "night" : "stripe" },
			}}
		>
			<CheckoutForm
				amount={amount}
				buttonLabel={buttonLabel}
				onSuccess={onSuccess}
				onError={onError}
			/>
		</Elements>
	);
}

function CheckoutForm(props: {
	amount: number;
	buttonLabel?: string;
	onSuccess?: () => void;
	onError?: (error: Error) => void;
}) {
	const { amount, buttonLabel, onSuccess, onError } = props;
	const stripe = useStripe();
	const elements = useElements();
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!stripe || !elements) {
			return;
		}
		setSubmitting(true);
		setMessage(null);

		const { error } = await stripe.confirmPayment({
			elements,
			confirmParams: {
				return_url:
					typeof window !== "undefined" ? window.location.href : undefined,
			},
			redirect: "if_required",
		});

		setSubmitting(false);

		if (error) {
			setMessage(error.message ?? "Payment failed");
			onError?.(new Error(error.message ?? "Payment failed"));
			return;
		}
		onSuccess?.();
	}

	return (
		<form className="lg-buy-credits" onSubmit={handleSubmit}>
			<PaymentElement />
			<button
				className="lg-buy-credits__submit"
				type="submit"
				disabled={!stripe || submitting}
			>
				{submitting ? "Processing…" : (buttonLabel ?? `Add $${amount} credits`)}
			</button>
			{message ? <div className="lg-buy-credits__error">{message}</div> : null}
		</form>
	);
}
