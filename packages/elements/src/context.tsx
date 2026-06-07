import { LLMGatewayClient } from "@llmgateway/client";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";

import type {
	Balance,
	LLMGatewayClient as Client,
	SessionRef,
} from "@llmgateway/client";
import type {
	RefetchUntilChangeOptions,
	UseBalanceResult,
} from "./useBalance.js";

export interface Appearance {
	theme?: "light" | "dark";
	/** CSS custom properties applied to the widget root, e.g. { "--lg-color-primary": "#6d28d9" }. */
	variables?: Record<string, string>;
	/** Extra class applied to the widget root. */
	className?: string;
}

/** LLM Gateway's Stripe publishable keys — safe to ship in the browser bundle. */
const STRIPE_PUBLISHABLE_KEY_LIVE =
	"pk_live_51RRXLsEAkKxa3kRayCPr9oW8dUp7mIzwev1FVpM3jpKU3StLaaiKvXCEPkewabL5hRip4IXLzFlFTLC4RpFWRknN00lX2vgZHP";
const STRIPE_PUBLISHABLE_KEY_TEST =
	"pk_test_51RRXM1CYKGHizcWTfXxFSEzN8gsUQkg2efi2FN5KO2M2hxdV9QPCjeZMPaZQHSAatxpK9wDcSeilyYU14gz2qA2p00R4q5xU1R";

export interface LLMGatewayProviderProps {
	/** The end-user session minted by your backend via `@llmgateway/server`. */
	session: SessionRef;
	/** Publishable key (`pk_…`) for your LLM Gateway project. */
	publishableKey?: string;
	/**
	 * Use LLM Gateway's Stripe test mode for the `<BuyCredits>` widget. Defaults
	 * to `false` (live mode).
	 */
	test?: boolean;
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
	/**
	 * Shared wallet-balance state. Lives here (not per-hook) so every
	 * `useBalance()` consumer — `<CreditBalance>`, a custom widget, the chat
	 * dashboard — reflects the same balance and a single refetch updates them
	 * all.
	 */
	balance: UseBalanceResult;
}

const LLMGatewayContext = createContext<LLMGatewayContextValue | null>(null);

/**
 * Owns the single shared balance state for a provider subtree. Mirrors the
 * public `UseBalanceResult` so `useBalance()` is just a thin reader of this.
 */
function useBalanceController(client: Client): UseBalanceResult {
	const [data, setData] = useState<Balance | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	// Track the latest balance synchronously so polling has a stable baseline
	// without depending on (and re-creating callbacks for) `data`.
	const latestBalance = useRef<string | null>(null);

	const refetch = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await client.getBalance();
			latestBalance.current = result.balance;
			setData(result);
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setLoading(false);
		}
	}, [client]);

	const refetchUntilChange = useCallback(
		async (opts?: RefetchUntilChangeOptions) => {
			const interval = opts?.interval ?? 1500;
			const timeout = opts?.timeout ?? 20000;
			const baseline = latestBalance.current;
			const deadline = Date.now() + timeout;
			setError(null);
			while (Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, interval));
				try {
					const result = await client.getBalance();
					latestBalance.current = result.balance;
					setData(result);
					if (result.balance !== baseline) {
						return true;
					}
				} catch (err) {
					setError(err instanceof Error ? err : new Error(String(err)));
				}
			}
			return false;
		},
		[client],
	);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return useMemo(
		() => ({
			balance: data?.balance ?? null,
			currency: data?.currency ?? null,
			recentLedger: data?.recentLedger ?? [],
			loading,
			error,
			refetch,
			refetchUntilChange,
		}),
		[data, loading, error, refetch, refetchUntilChange],
	);
}

export function LLMGatewayProvider(props: LLMGatewayProviderProps) {
	const {
		session,
		publishableKey,
		test = false,
		gatewayBaseUrl,
		apiBaseUrl,
		fetchSession,
		appearance,
		children,
	} = props;

	const stripePublishableKey = test
		? STRIPE_PUBLISHABLE_KEY_TEST
		: STRIPE_PUBLISHABLE_KEY_LIVE;

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

	const balance = useBalanceController(client);

	const value = useMemo<LLMGatewayContextValue>(
		() => ({ client, stripePublishableKey, appearance, balance }),
		[client, stripePublishableKey, appearance, balance],
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
