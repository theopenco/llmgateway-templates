import { useBalance } from "./useBalance.js";

export interface CreditBalanceProps {
	/** Override the rendered label. */
	label?: string;
	/** Render-prop for full control over presentation. */
	children?: (state: {
		balance: string | null;
		currency: string | null;
		loading: boolean;
	}) => React.ReactNode;
}

function formatBalance(balance: string | null, currency: string | null): string {
	if (balance === null) {
		return "—";
	}
	const n = Number(balance);
	if (!Number.isFinite(n)) {
		return balance;
	}
	const prefix = currency === "USD" || !currency ? "$" : "";
	return `${prefix}${n.toFixed(2)}${prefix ? "" : ` ${currency}`}`;
}

/** Displays the end-user's current credit balance. */
export function CreditBalance(props: CreditBalanceProps) {
	const { label = "Balance", children } = props;
	const { balance, currency, loading } = useBalance();

	if (children) {
		return <>{children({ balance, currency, loading })}</>;
	}

	return (
		<div className="lg-credit-balance">
			<span className="lg-credit-balance__label">{label}</span>
			<span className="lg-credit-balance__value">
				{loading ? "…" : formatBalance(balance, currency)}
			</span>
		</div>
	);
}
