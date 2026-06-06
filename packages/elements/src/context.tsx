import { LLMGatewayClient } from "@llmgateway/client";
import {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
} from "react";

import type { SessionRef } from "@llmgateway/client";

export interface Appearance {
	theme?: "light" | "dark";
	/** CSS custom properties applied to the widget root, e.g. { "--lg-color-primary": "#6d28d9" }. */
	variables?: Record<string, string>;
	/** Extra class applied to the widget root. */
	className?: string;
}

export interface LLMGatewayProviderProps {
	/** The end-user session minted by your backend via `@llmgateway/server`. */
	session: SessionRef;
	/** Publishable key (`pk_…`) for your LLM Gateway project. */
	publishableKey?: string;
	/**
	 * LLM Gateway's Stripe publishable key, used to load Stripe.js for the
	 * `<BuyCredits>` widget. Required only if you render `<BuyCredits>`.
	 */
	stripePublishableKey?: string;
	gatewayBaseUrl?: string;
	apiBaseUrl?: string;
	/** Obtain a fresh session when the current one nears expiry (hits your backend). */
	fetchSession?: () => Promise<SessionRef>;
	appearance?: Appearance;
	children: ReactNode;
}

interface LLMGatewayContextValue {
	client: LLMGatewayClient;
	stripePublishableKey?: string;
	appearance?: Appearance;
}

const LLMGatewayContext = createContext<LLMGatewayContextValue | null>(null);

export function LLMGatewayProvider(props: LLMGatewayProviderProps) {
	const {
		session,
		publishableKey,
		stripePublishableKey,
		gatewayBaseUrl,
		apiBaseUrl,
		fetchSession,
		appearance,
		children,
	} = props;

	const client = useMemo(
		() =>
			new LLMGatewayClient({
				session,
				publishableKey,
				gatewayBaseUrl,
				apiBaseUrl,
				refresh: fetchSession,
			}),
		// Re-create only when connection-defining inputs change. The session token
		// is read fresh on each call and auto-refreshed via `fetchSession`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[publishableKey, gatewayBaseUrl, apiBaseUrl],
	);

	const value = useMemo<LLMGatewayContextValue>(
		() => ({ client, stripePublishableKey, appearance }),
		[client, stripePublishableKey, appearance],
	);

	const style = appearanceToStyle(appearance);

	return (
		<LLMGatewayContext.Provider value={value}>
			<div
				className={["lg-root", appearance?.className].filter(Boolean).join(" ")}
				data-lg-theme={appearance?.theme ?? "light"}
				style={style}
			>
				{children}
			</div>
		</LLMGatewayContext.Provider>
	);
}

export function useLLMGateway(): LLMGatewayContextValue {
	const ctx = useContext(LLMGatewayContext);
	if (!ctx) {
		throw new Error(
			"useLLMGateway must be used within an <LLMGatewayProvider>.",
		);
	}
	return ctx;
}

function appearanceToStyle(
	appearance?: Appearance,
): Record<string, string> | undefined {
	if (!appearance?.variables) {
		return undefined;
	}
	return { ...appearance.variables };
}
