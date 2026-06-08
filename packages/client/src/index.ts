/**
 * @llmgateway/client — browser-safe headless client for LLM Gateway embeddable AI.
 *
 * Runs in the END-USER's browser. It holds only an ephemeral **session token**
 * (`es_…`, minted by your backend via `@llmgateway/server`) and a publishable
 * key — never your secret key. AI usage is billed to the end-user wallet the
 * session is bound to. Framework-agnostic; `@llmgateway/elements` wraps this for
 * React.
 *
 *   const client = new LLMGatewayClient({
 *     session: { token: es, expiresAt },
 *     refresh: () => fetch("/api/llmgateway/session").then((r) => r.json()),
 *   });
 *   for await (const delta of client.stream({ model: "openai/gpt-4o-mini", messages }))
 *     process.stdout.write(delta);
 */

export interface SessionRef {
  /** Ephemeral token, `es_…`. */
  token: string;
  /** ISO timestamp; the client auto-refreshes shortly before this. */
  expiresAt?: string;
}

export interface LLMGatewayClientOptions {
  session: SessionRef;
  /** Publishable key (`pk_…`) — used by `@llmgateway/elements` to load Stripe. */
  publishableKey?: string;
  /** Gateway base URL (OpenAI-compatible). Defaults to the hosted service. */
  gatewayBaseUrl?: string;
  /** API base URL (wallet/balance). Defaults to the hosted service. */
  apiBaseUrl?: string;
  /**
   * Called to obtain a fresh session when the current one is near/after expiry.
   * Typically hits your backend, which mints one with `@llmgateway/server`.
   */
  refresh?: () => Promise<SessionRef>;
  /** Optional custom fetch (testing / proxies). */
  fetch?: typeof fetch;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  [key: string]: unknown;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Any other OpenAI-compatible field is passed through. */
  [key: string]: unknown;
}

export interface ChatResult {
  id: string;
  model: string;
  content: string;
  finishReason: string | null;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  /** The raw OpenAI-compatible response. */
  raw: unknown;
}

export interface ImageParams {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  [key: string]: unknown;
}

export interface GeneratedImage {
  /** Base64-encoded image (when the provider returns inline data). */
  b64_json?: string;
  /** Image URL (when the provider returns a hosted URL). */
  url?: string;
}

export interface ImageResult {
  images: GeneratedImage[];
  raw: unknown;
}

export interface EmbeddingsParams {
  model: string;
  input: string | string[];
  [key: string]: unknown;
}

export interface EmbeddingsResult {
  embeddings: number[][];
  usage?: { prompt_tokens?: number; total_tokens?: number };
  raw: unknown;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  createdAt: string;
  description: string | null;
}

export interface Balance {
  /** Decimal string, USD spend power. */
  balance: string;
  currency: string;
  recentLedger: LedgerEntry[];
}

export interface TopUp {
  /** Stripe PaymentIntent client secret — confirm it with Stripe.js. */
  clientSecret: string;
  /** Total charged to the card (credits + fees). */
  totalAmount: number;
  /** Real spend power credited to the wallet after the developer markup. */
  netCredited: number;
  isInternational: boolean;
}

/** @internal Loose shape of an error response body. */
interface ErrorBody {
  error?: { message?: string };
  message?: string;
}

/** @internal OpenAI-compatible chat completion response. */
interface ChatCompletionResponse extends ErrorBody {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string | null;
  }>;
  usage?: ChatResult["usage"];
}

/** @internal OpenAI-compatible streaming chunk. */
interface ChatCompletionChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

/** @internal OpenAI-compatible image generation response. */
interface ImageGenerationResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

/** @internal OpenAI-compatible embeddings response. */
interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  usage?: EmbeddingsResult["usage"];
}

const DEFAULT_GATEWAY_BASE_URL = "https://api.llmgateway.io";
const DEFAULT_API_BASE_URL = "https://internal.llmgateway.io";
/** Refresh this many ms before expiry. */
const REFRESH_SKEW_MS = 60_000;

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

export class LLMGatewayClient {
  private session: SessionRef;
  private readonly publishableKey?: string;
  private readonly gatewayBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly refreshFn?: () => Promise<SessionRef>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LLMGatewayClientOptions) {
    if (!options.session?.token) {
      throw new Error("LLMGatewayClient: `session.token` is required");
    }
    this.session = options.session;
    this.publishableKey = options.publishableKey;
    this.gatewayBaseUrl = (
      options.gatewayBaseUrl ?? DEFAULT_GATEWAY_BASE_URL
    ).replace(/\/$/, "");
    this.apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.refreshFn = options.refresh;
    // Bind the default to globalThis: calling `this.fetchImpl(...)` would
    // otherwise invoke the browser's `fetch` with `this` set to this client
    // instance, which throws "Illegal invocation".
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  getPublishableKey(): string | undefined {
    return this.publishableKey;
  }

  /** Non-streaming chat completion. */
  async chat(params: ChatParams): Promise<ChatResult> {
    const token = await this.validToken();
    const res = await this.fetchImpl(
      `${this.gatewayBaseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...params, stream: false }),
      },
    );

    const data = (await res.json()) as ChatCompletionResponse;
    if (!res.ok) {
      throw new LLMGatewayError(
        res.status,
        data?.error?.message ?? data?.message ?? "Chat request failed",
        data,
      );
    }

    const choice = data?.choices?.[0];
    return {
      id: data?.id ?? "",
      model: data?.model ?? params.model,
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? null,
      usage: data?.usage,
      raw: data,
    };
  }

  /** Streaming chat completion — yields content deltas as they arrive. */
  async *stream(params: ChatParams): AsyncGenerator<string, void, unknown> {
    const token = await this.validToken();
    const res = await this.fetchImpl(
      `${this.gatewayBaseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...params, stream: true }),
      },
    );

    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => undefined)) as
        | ErrorBody
        | undefined;
      throw new LLMGatewayError(
        res.status,
        data?.error?.message ?? "Stream request failed",
        data,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const payload = trimmed.slice("data:".length).trim();
          if (payload === "[DONE]") {
            return;
          }
          try {
            const json = JSON.parse(payload) as ChatCompletionChunk;
            const delta = json?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yield delta;
            }
          } catch {
            // Ignore keep-alives / non-JSON comments.
          }
        }
      }
    }
  }

  /** Generate image(s) via the OpenAI-compatible images endpoint. */
  async image(params: ImageParams): Promise<ImageResult> {
    const data = (await this.gatewayPost(
      "/v1/images/generations",
      params,
    )) as ImageGenerationResponse;
    const images: GeneratedImage[] = Array.isArray(data?.data)
      ? data.data.map((d) => ({ b64_json: d?.b64_json, url: d?.url }))
      : [];
    return { images, raw: data };
  }

  /** Create embeddings via the OpenAI-compatible embeddings endpoint. */
  async embeddings(params: EmbeddingsParams): Promise<EmbeddingsResult> {
    const data = (await this.gatewayPost(
      "/v1/embeddings",
      params,
    )) as EmbeddingResponse;
    const embeddings: number[][] = Array.isArray(data?.data)
      ? data.data.map((d) => d?.embedding ?? [])
      : [];
    return { embeddings, usage: data?.usage, raw: data };
  }

  /** @internal POST to the gateway with the (refreshed) session token. */
  private async gatewayPost(path: string, body: unknown): Promise<unknown> {
    const token = await this.validToken();
    const res = await this.fetchImpl(`${this.gatewayBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as ErrorBody;
    if (!res.ok) {
      throw new LLMGatewayError(
        res.status,
        data?.error?.message ?? data?.message ?? "Request failed",
        data,
      );
    }
    return data;
  }

  /** Fetch the end-user wallet balance + recent ledger. */
  async getBalance(): Promise<Balance> {
    const token = await this.validToken();
    const res = await this.fetchImpl(`${this.apiBaseUrl}/v1/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as Balance & ErrorBody;
    if (!res.ok) {
      throw new LLMGatewayError(
        res.status,
        data?.message ?? "Failed to fetch balance",
        data,
      );
    }
    return data;
  }

  /**
   * Create a Stripe PaymentIntent to add `amount` of credits to the wallet.
   * Confirm the returned `clientSecret` client-side (e.g. with `@llmgateway/elements`).
   */
  async createTopUp(amount: number): Promise<TopUp> {
    const token = await this.validToken();
    const res = await this.fetchImpl(`${this.apiBaseUrl}/v1/wallet/top-up`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });
    const data = (await res.json()) as TopUp & ErrorBody;
    if (!res.ok) {
      throw new LLMGatewayError(
        res.status,
        data?.message ?? "Failed to create top-up",
        data,
      );
    }
    return data;
  }

  /**
   * Rotate the session token via `/v1/sessions/refresh` using the current
   * (still-valid) token. Returns the new session.
   */
  async refreshSession(): Promise<SessionRef> {
    const res = await this.fetchImpl(`${this.apiBaseUrl}/v1/sessions/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.session.token}` },
    });
    const data = (await res.json()) as {
      sessionToken: string;
      expiresAt?: string;
    } & ErrorBody;
    if (!res.ok) {
      throw new LLMGatewayError(
        res.status,
        data?.message ?? "Failed to refresh session",
        data,
      );
    }
    this.session = { token: data.sessionToken, expiresAt: data.expiresAt };
    return this.session;
  }

  /**
   * Returns a non-expired session token. When within the skew window of expiry,
   * rotates the token: via `/v1/sessions/refresh` if the token is still valid,
   * otherwise via the developer-provided `refresh` hook (which mints a brand new
   * session from their backend).
   */
  private async validToken(): Promise<string> {
    const expiresAt = this.session.expiresAt
      ? Date.parse(this.session.expiresAt)
      : undefined;
    const nearExpiry =
      expiresAt !== undefined &&
      Number.isFinite(expiresAt) &&
      Date.now() >= expiresAt - REFRESH_SKEW_MS;

    if (!nearExpiry) {
      return this.session.token;
    }

    const expired = expiresAt !== undefined && Date.now() >= expiresAt;
    try {
      // Self-refresh only works while the current token is still valid.
      if (!expired) {
        await this.refreshSession();
        return this.session.token;
      }
    } catch {
      // Fall through to the developer-provided hook.
    }

    if (this.refreshFn) {
      this.session = await this.refreshFn();
    }
    return this.session.token;
  }
}
