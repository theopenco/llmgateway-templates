import { setTimeout as delay } from "node:timers/promises";
import { normalizeUrl } from "./config.js";
import { ApiError } from "./api.js";

const CLIENT_ID = "llmgateway-cli";
export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

export function parseDeviceCode(
  value: unknown,
  dashboardUrl: string,
): DeviceCode {
  const code = value as Partial<DeviceCode> | null;
  if (
    !code ||
    typeof code.device_code !== "string" ||
    !code.device_code ||
    typeof code.user_code !== "string" ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(code.user_code) ||
    typeof code.verification_uri !== "string" ||
    !Number.isFinite(code.expires_in) ||
    code.expires_in! <= 0 ||
    (code.interval !== undefined &&
      (!Number.isFinite(code.interval) || code.interval <= 0))
  ) {
    throw new Error("Invalid device authorization response.");
  }
  const expected = new URL(normalizeUrl(dashboardUrl));
  const verification = new URL(code.verification_uri);
  if (
    verification.origin !== expected.origin ||
    verification.username ||
    verification.password ||
    verification.hash
  ) {
    throw new Error(
      "The verification URL does not belong to the configured dashboard. Check --dashboard-url.",
    );
  }
  if (code.verification_uri_complete !== undefined) {
    if (typeof code.verification_uri_complete !== "string")
      throw new Error("Invalid verification URL.");
    const complete = new URL(code.verification_uri_complete);
    if (
      complete.origin !== verification.origin ||
      complete.pathname !== verification.pathname ||
      complete.username ||
      complete.password ||
      complete.hash
    ) {
      throw new Error(
        "The complete verification URL does not match the verification page.",
      );
    }
    if (complete.searchParams.get("user_code") !== code.user_code)
      throw new Error("The verification URL contains a different user code.");
  }
  return code as DeviceCode;
}

export function verificationUrl(
  code: DeviceCode,
  dashboardUrl: string,
  sso?: string | boolean,
): string {
  const target = new URL(
    code.verification_uri_complete ?? code.verification_uri,
  );
  if (!code.verification_uri_complete)
    target.searchParams.set("user_code", code.user_code);
  if (!sso) return target.toString();
  const url = new URL(`${normalizeUrl(dashboardUrl)}/sso`);
  url.searchParams.set("redirect", `${target.pathname}${target.search}`);
  if (typeof sso === "string") url.searchParams.set("email", sso);
  return url.toString();
}

interface DeviceLoginOptions {
  apiUrl: string;
  dashboardUrl: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onCode: (code: DeviceCode) => Promise<void>;
}

/** First-party Better Auth device flow. The token is returned only to the polling CLI. */
export async function deviceLogin(
  options: DeviceLoginOptions,
): Promise<string> {
  const timeout = options.timeoutMs ?? 10 * 60 * 1000;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 30 * 60 * 1000) {
    throw new Error("Login timeout must be between 1 and 1800 seconds.");
  }
  const deadline = AbortSignal.timeout(timeout);
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline])
    : deadline;
  const apiUrl = normalizeUrl(options.apiUrl);
  const post = (endpoint: string, body: Record<string, string>) =>
    fetch(`${apiUrl}/auth/device/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(normalizeUrl(options.dashboardUrl)).origin,
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
  const response = await post("code", { client_id: CLIENT_ID });
  if (response.status === 404)
    throw new ApiError(
      404,
      "This deployment does not support browser login yet. Enable the CLI device authorization integration, or use `auth login --email` / `auth login --key`.",
    );
  if (!response.ok)
    throw new ApiError(
      response.status,
      `Could not start browser login (HTTP ${response.status}).`,
    );
  const code = parseDeviceCode(await response.json(), options.dashboardUrl);
  const expiresAt = Date.now() + Math.min(code.expires_in * 1000, timeout);
  await options.onCode(code);
  let interval = Math.max(1, code.interval ?? 5) * 1000;
  while (Date.now() < expiresAt) {
    await delay(Math.min(interval, expiresAt - Date.now()), undefined, {
      signal,
    });
    if (Date.now() >= expiresAt) break;
    const tokenResponse = await post("token", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: code.device_code,
      client_id: CLIENT_ID,
    });
    const data: unknown = await tokenResponse.json().catch(() => ({}));
    const token = (data && typeof data === "object" ? data : {}) as {
      access_token?: unknown;
      error?: string;
    };
    if (tokenResponse.ok) {
      if (
        typeof token.access_token !== "string" ||
        !token.access_token ||
        [...token.access_token].some(
          (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
        )
      )
        throw new Error("The server returned an invalid session token.");
      return token.access_token;
    }
    if (token.error === "authorization_pending") continue;
    if (token.error === "slow_down" || tokenResponse.status === 429) {
      interval += 5000;
      continue;
    }
    if (token.error === "access_denied")
      throw new Error("Browser sign-in was denied. No credentials were saved.");
    if (token.error === "expired_token") break;
    throw new ApiError(
      tokenResponse.status,
      `Browser sign-in failed (${token.error ?? tokenResponse.status}).`,
    );
  }
  throw new Error(
    "Browser sign-in expired. Run `llmgateway auth login` to try again.",
  );
}
