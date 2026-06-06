import { useCallback, useEffect, useState } from "react";

import { useLLMGateway } from "./context.js";

import type { Balance } from "@llmgateway/client";

export interface UseBalanceResult {
	balance: string | null;
	currency: string | null;
	recentLedger: Balance["recentLedger"];
	loading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

/**
 * Fetches and tracks the end-user wallet balance. Call `refetch()` after a
 * top-up succeeds (or poll) to reflect the new balance once the webhook lands.
 */
export function useBalance(): UseBalanceResult {
	const { client } = useLLMGateway();
	const [data, setData] = useState<Balance | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const refetch = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setData(await client.getBalance());
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setLoading(false);
		}
	}, [client]);

	useEffect(() => {
		void refetch();
	}, [refetch]);

	return {
		balance: data?.balance ?? null,
		currency: data?.currency ?? null,
		recentLedger: data?.recentLedger ?? [],
		loading,
		error,
		refetch,
	};
}
