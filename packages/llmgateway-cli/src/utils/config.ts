import fs from "fs-extra";
import path from "path";
import os from "os";
import { randomUUID } from "node:crypto";

export interface Config {
  apiKey?: string;
  defaultTemplate?: string;
  /** Better Auth session cookie used for management API calls */
  sessionCookie?: string;
  /** First-party device authorization session token. */
  sessionToken?: string;
  /** Management API instance that issued the credentials. */
  sessionApiUrl?: string;
  /** Email of the signed-in user (informational) */
  sessionEmail?: string;
  /** Override for the management API base URL */
  apiUrl?: string;
  dashboardUrl?: string;
  gatewayUrl?: string;
  /** Default org/project used when --org/--project are omitted */
  defaultOrgId?: string;
  defaultProjectId?: string;
}

// Management API (Better Auth, orgs, keys, usage) — NOT the gateway
// (https://api.llmgateway.io), which only serves /v1 inference routes.
const DEFAULT_API_URL = "https://internal.llmgateway.io";

export function configDir(): string {
  return process.env.LLMGATEWAY_CONFIG_DIR
    ? path.resolve(process.env.LLMGATEWAY_CONFIG_DIR)
    : path.join(os.homedir(), ".llmgateway");
}

export function configFile(): string {
  return path.join(configDir(), "config.json");
}

/** Atomic replacement prevents a interrupted write from destroying credentials. */
export async function writePrivateJson(
  file: string,
  value: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    await fs.rename(temp, file);
  } finally {
    await fs.remove(temp);
  }
}

export async function getConfig(): Promise<Config> {
  try {
    const config: unknown = await fs.readJson(configFile());
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("Expected a JSON object");
    }
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && typeof value !== "string") {
        throw new Error(`Invalid value for ${key}: expected a string`);
      }
    }
    return config as Config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(
      `Cannot read ${configFile()}. Repair the configuration before continuing.`,
      { cause: error },
    );
  }
}

export async function setConfig(updates: Partial<Config>): Promise<void> {
  const current = await getConfig();
  const updated = { ...current, ...updates };
  await writePrivateJson(configFile(), updated);
}

export async function clearConfig(): Promise<void> {
  await setConfig({
    apiKey: undefined,
    sessionCookie: undefined,
    sessionToken: undefined,
    sessionEmail: undefined,
    sessionApiUrl: undefined,
    defaultOrgId: undefined,
    defaultProjectId: undefined,
  });
}

export function getEnvApiKey(): string | undefined {
  return process.env.LLMGATEWAY_API_KEY;
}

export async function getApiUrl(): Promise<string> {
  const envUrl = process.env.LLMGATEWAY_API_URL;
  if (envUrl) return normalizeUrl(envUrl);

  const config = await getConfig();
  if (config.apiUrl) return normalizeUrl(config.apiUrl);

  return DEFAULT_API_URL;
}

/** Credentials may only travel over HTTPS, except explicit loopback development. */
export function normalizeUrl(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "Use an HTTPS URL (HTTP is supported only on localhost), without credentials, query, or fragment.",
    );
  }
  return url.toString().replace(/\/+$/, "");
}

export async function getDashboardUrl(): Promise<string> {
  const config = await getConfig();
  return normalizeUrl(
    process.env.LLMGATEWAY_ORIGIN_URL ??
      config.dashboardUrl ??
      "https://llmgateway.io",
  );
}

export async function getGatewayUrl(explicit?: string): Promise<string> {
  const config = await getConfig();
  return normalizeUrl(
    explicit ??
      process.env.LLMGATEWAY_GATEWAY_URL ??
      config.gatewayUrl ??
      "https://api.llmgateway.io",
  );
}

export async function sessionHeaders(): Promise<Record<string, string>> {
  const config = await getConfig();
  if (!config.sessionCookie && !config.sessionToken) return {};
  const apiUrl = await getApiUrl();
  // Legacy cookies were issued by the hosted management API. Never forward
  // them to a different instance when an environment override changes.
  if (normalizeUrl(config.sessionApiUrl ?? DEFAULT_API_URL) !== apiUrl) {
    throw new Error(
      "Your session belongs to another LLM Gateway instance. Run `llmgateway auth login` for this instance.",
    );
  }
  return config.sessionToken
    ? { Authorization: `Bearer ${config.sessionToken}` }
    : { Cookie: config.sessionCookie! };
}

export async function getApiKey(): Promise<string | undefined> {
  // Environment variable takes precedence
  const envKey = getEnvApiKey();
  if (envKey) return envKey;

  // Fall back to config file
  const config = await getConfig();
  return config.apiKey;
}
