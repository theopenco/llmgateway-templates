import { useLLMGateway } from "./context.js";

import type { Balance } from "@llmgateway/client";

export interface RefetchUntilChangeOptions {
	/** Milliseconds between polls. Default 1500. */
	interval?: number;
	/** Give up after this many milliseconds. Default 20000. */
	timeout?: number;
}

export interface UseBalanceResult {
	balance: string | null;
	currency: string | null;
	recentLedger: Balance["recentLedger"];
	loading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
	/**
	 * Polls the balance until it differs from the currently-known value (or the
	 * timeout elapses). Use after a top-up: the wallet is credited asynchronously
	 * once LLM Gateway's webhook processes the payment, so a single refetch can
	 * fire before the credit lands. Resolves `true` if a change was observed.
	 */
	refetchUntilChange: (opts?: RefetchUntilChangeOptions) => Promise<boolean>;
}

/**
 * Reads the end-user wallet balance from the shared provider state. Every
 * consumer in a provider subtree sees the same balance, so calling `refetch()`
 * or `refetchUntilChange()` anywhere updates all of them (e.g. `<CreditBalance>`
 * reflects a top-up triggered from a separate widget).
 */
export function useBalance(): UseBalanceResult {
	return useLLMGateway().balance;
}
