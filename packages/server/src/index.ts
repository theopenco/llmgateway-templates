import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * @llmgateway/server — server-side SDK for LLM Gateway embeddable AI.
 *
 * Use this in your backend with your secret key (`sk_…`). It mints short-lived
 * end-user **session tokens** that your frontend hands to `@llmgateway/client` /
 * `@llmgateway/elements`, and manages per-end-user **wallets**. Modeled on the
 * Stripe Node SDK.
 *
 *   const lg = new LLMGateway({ secretKey: process.env.LLMGATEWAY_SECRET_KEY! });
 *   const session = await lg.sessions.create({ customer: { externalId: user.id } });
 *   // → return session to the browser
 */

export interface LLMGatewayOptions {
	/** Your platform secret key, `sk_…`. Never expose this to the browser. */
	secretKey: string;
	/**
	 * Base URL of the LLM Gateway API (where sessions/wallets live).
	 * Defaults to the hosted service.
	 */
	apiBaseUrl?: string;
	/** Optional custom fetch (e.g. for testing or a proxy). */
	fetch?: typeof fetch;
}

export interface CustomerInput {
	/** Your own user id — stable across sessions. */
	externalId: string;
	email?: string;
	name?: string;
}

export interface SessionScope {
	/** Allowlist of model ids the session may call (maps to an IAM rule). */
	models?: string[];
	/** Optional spend ceiling (USD) for this session's key. */
	maxSpend?: number;
}

export interface CreateSessionParams {
	/** The end customer this session acts as — a string externalId or an object. */
	customer: string | CustomerInput;
	scope?: SessionScope;
	/** Token lifetime in seconds (60–3600, default 900). */
	ttlSeconds?: number;
}

export interface Session {
	/** Browser-safe ephemeral token, `es_…`. Expires; mint a new one when it does. */
	sessionToken: string;
	/** Publishable key for loading Stripe in the browser (null until configured). */
	publishableKey: string | null;
	walletId: string;
	endCustomerId: string;
	/** ISO timestamp. */
	expiresAt: string;
}

export interface Wallet {
	id: string;
	endCustomerId: string;
	/** Decimal string, USD spend power. */
	balance: string;
	currency: string;
	status: "active" | "frozen";
}

export interface CreditWalletParams {
	walletId: string;
	/** Amount of credits (USD) to grant. */
	amount: number;
	/** Optional human-readable reason recorded in the wallet ledger. */
	reason?: string;
}

export interface WalletSummary {
	id: string;
	balance: string;
	currency: string;
	status: "active" | "frozen";
}

export interface EndCustomerSummary {
	id: string;
	externalId: string;
	email: string | null;
	name: string | null;
	status: "active" | "blocked" | "deleted";
	createdAt: string;
	wallet: WalletSummary | null;
	/** Total real USD spent on AI (sum of usage debits). */
	lifetimeSpend: string;
	/** Total real USD credited to the wallet from top-ups. */
	lifetimeToppedUp: string;
}

export interface LedgerEntry {
	id: string;
	type: string;
	amount: string;
	balanceAfter: string;
	createdAt: string;
	description: string | null;
}

export interface EndCustomerDetail extends EndCustomerSummary {
	recentLedger: LedgerEntry[];
}

export interface ListCustomersParams {
	limit?: number;
	offset?: number;
}

export interface OnboardingLinkParams {
	/** Where Stripe sends the user if the link expires; re-create and redirect. */
	refreshUrl: string;
	/** Where Stripe returns the user after onboarding. */
	returnUrl: string;
}

export interface ConnectStatus {
	accountId: string | null;
	onboarded: boolean;
	payoutsEnabled: boolean;
	/** Accrued, payable developer margin (USD). */
	marginBalance: string;
}

export interface Payout {
	transferId: string;
	amount: string;
	/** Remaining margin balance after the payout. */
	marginBalance: string;
}

export interface WebhookEndpoint {
	id: string;
	url: string;
	enabledEvents: string[] | null;
	status: "active" | "disabled";
	createdAt: string;
}

export interface CreateWebhookEndpointParams {
	url: string;
	/** Event types to subscribe to; omit for all. */
	enabledEvents?: string[];
}

export interface WebhookEvent<T = Record<string, unknown>> {
	id: string;
	type: string;
	data: T;
}

const DEFAULT_API_BASE_URL = "https://api.llmgateway.io";

export class LLMGatewayError extends Error {
	readonly status: number;
	readonly body: unknown;
	constructor(status: number, message: string, body: unknown) {
		super(message);
		this.name = "LLMGatewayError";
		this.status = status;
		this.body = body;
	}
}

export class LLMGateway {
	private readonly secretKey: string;
	private readonly apiBaseUrl: string;
	private readonly fetchImpl: typeof fetch;

	readonly sessions: Sessions;
	readonly wallets: Wallets;
	readonly customers: Customers;
	readonly connect: Connect;
	readonly webhookEndpoints: WebhookEndpoints;
	readonly webhooks: Webhooks;

	constructor(options: LLMGatewayOptions) {
		if (!options.secretKey) {
			throw new Error("LLMGateway: `secretKey` is required");
		}
		this.secretKey = options.secretKey;
		this.apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(
			/\/$/,
			"",
		);
		this.fetchImpl = options.fetch ?? globalThis.fetch;
		this.sessions = new Sessions(this);
		this.wallets = new Wallets(this);
		this.customers = new Customers(this);
		this.connect = new Connect(this);
		this.webhookEndpoints = new WebhookEndpoints(this);
		this.webhooks = new Webhooks();
	}

	/** @internal */
	async request<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> {
		const res = await this.fetchImpl(`${this.apiBaseUrl}/v1${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.secretKey}`,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		const text = await res.text();
		const parsed = text ? safeJson(text) : undefined;

		if (!res.ok) {
			const message =
				(parsed && typeof parsed === "object" && "message" in parsed
					? String((parsed as { message: unknown }).message)
					: undefined) ?? `Request failed with status ${res.status}`;
			throw new LLMGatewayError(res.status, message, parsed ?? text);
		}

		return parsed as T;
	}
}

class Sessions {
	constructor(private readonly client: LLMGateway) {}

	/** Mint a browser-safe ephemeral session bound to one end-user wallet. */
	create(params: CreateSessionParams): Promise<Session> {
		return this.client.request<Session>("POST", "/sessions", params);
	}
}

class Wallets {
	constructor(private readonly client: LLMGateway) {}

	/** Fetch a wallet (including current balance). */
	retrieve(walletId: string): Promise<Wallet> {
		return this.client.request<Wallet>(
			"GET",
			`/wallets/${encodeURIComponent(walletId)}`,
		);
	}

	/** Grant credits to a wallet server-side (e.g. free trial credits). */
	credit(params: CreditWalletParams): Promise<Wallet> {
		const { walletId, ...body } = params;
		return this.client.request<Wallet>(
			"POST",
			`/wallets/${encodeURIComponent(walletId)}/credit`,
			body,
		);
	}
}

class Customers {
	constructor(private readonly client: LLMGateway) {}

	/** List end customers with wallet balances + lifetime spend. */
	list(params: ListCustomersParams = {}): Promise<{
		customers: EndCustomerSummary[];
	}> {
		const qs = new URLSearchParams();
		if (params.limit !== undefined) {
			qs.set("limit", String(params.limit));
		}
		if (params.offset !== undefined) {
			qs.set("offset", String(params.offset));
		}
		const suffix = qs.toString() ? `?${qs.toString()}` : "";
		return this.client.request("GET", `/customers${suffix}`);
	}

	/** Retrieve a single end customer with wallet + recent ledger. */
	retrieve(customerId: string): Promise<EndCustomerDetail> {
		return this.client.request(
			"GET",
			`/customers/${encodeURIComponent(customerId)}`,
		);
	}
}

class Connect {
	constructor(private readonly client: LLMGateway) {}

	/**
	 * Create a Stripe Connect onboarding link. Redirect the developer to the
	 * returned `url` to connect a payout account.
	 */
	createOnboardingLink(
		params: OnboardingLinkParams,
	): Promise<{ accountId: string; url: string }> {
		return this.client.request("POST", "/connect/onboard", params);
	}

	/** Onboarding status + the accrued, payable margin balance. */
	status(): Promise<ConnectStatus> {
		return this.client.request("GET", "/connect/status");
	}

	/** Transfer the accrued end-user margin to the connected account. */
	payout(): Promise<Payout> {
		return this.client.request("POST", "/connect/payouts");
	}
}

class WebhookEndpoints {
	constructor(private readonly client: LLMGateway) {}

	/** Register a webhook endpoint. The returned `secret` is shown only once. */
	create(
		params: CreateWebhookEndpointParams,
	): Promise<WebhookEndpoint & { secret: string }> {
		return this.client.request("POST", "/webhooks", params);
	}

	/** List webhook endpoints (without secrets). */
	list(): Promise<{ endpoints: WebhookEndpoint[] }> {
		return this.client.request("GET", "/webhooks");
	}

	/** Delete a webhook endpoint. */
	del(endpointId: string): Promise<{ message: string }> {
		return this.client.request(
			"DELETE",
			`/webhooks/${encodeURIComponent(endpointId)}`,
		);
	}
}

export interface ConstructEventOptions {
	/** Max age (seconds) of the signature timestamp. Default 300. */
	toleranceSeconds?: number;
}

class Webhooks {
	/**
	 * Verify a webhook signature and parse the event. Pass the RAW request body
	 * string (not the parsed object), the `X-LLMGateway-Signature` header, and
	 * the endpoint's signing secret. Throws if verification fails — modeled on
	 * Stripe's `webhooks.constructEvent`.
	 */
	constructEvent<T = Record<string, unknown>>(
		payload: string,
		signatureHeader: string,
		secret: string,
		options: ConstructEventOptions = {},
	): WebhookEvent<T> {
		const tolerance = options.toleranceSeconds ?? 300;

		const parts: Record<string, string> = {};
		for (const seg of signatureHeader.split(",")) {
			const idx = seg.indexOf("=");
			if (idx > 0) {
				parts[seg.slice(0, idx).trim()] = seg.slice(idx + 1).trim();
			}
		}
		const t = parts.t;
		const v1 = parts.v1;
		if (!t || !v1) {
			throw new Error("Invalid LLMGateway signature header");
		}

		const expected = createHmac("sha256", secret)
			.update(`${t}.${payload}`)
			.digest("hex");

		const provided = Buffer.from(v1);
		const computed = Buffer.from(expected);
		if (
			provided.length !== computed.length ||
			!timingSafeEqual(provided, computed)
		) {
			throw new Error("Webhook signature verification failed");
		}

		const ts = Number(t);
		if (
			!Number.isFinite(ts) ||
			Math.abs(Date.now() / 1000 - ts) > tolerance
		) {
			throw new Error("Webhook timestamp outside of tolerance");
		}

		return JSON.parse(payload) as WebhookEvent<T>;
	}
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
