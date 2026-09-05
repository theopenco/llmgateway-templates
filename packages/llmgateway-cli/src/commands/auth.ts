import prompts from "prompts";
import open from "open";
import { logger, highlight, dim, bold } from "../utils/logger.js";
import {
  getConfig,
  configFile,
  setConfig,
  clearConfig,
  getEnvApiKey,
  getApiUrl,
  getDashboardUrl,
  normalizeUrl,
  sessionHeaders,
  type Config,
} from "../utils/config.js";
import {
  signInWithEmail,
  getSessionUser,
  ApiError,
  resolveOrgId,
} from "../utils/api.js";
import { deviceLogin, verificationUrl } from "../utils/device-auth.js";

interface LoginOptions {
  key?: boolean;
  /** --email may be a bare flag (true) or carry a value */
  email?: string | boolean;
  sso?: string | boolean;
  browser?: boolean;
  apiUrl?: string;
  dashboardUrl?: string;
  gatewayUrl?: string;
  org?: string;
  timeout?: string;
}

export async function authLogin(options: LoginOptions = {}): Promise<void> {
  logger.blank();
  logger.log(bold("LLM Gateway Authentication"));
  logger.blank();

  if (
    [
      options.key,
      options.email !== undefined,
      options.sso !== undefined,
    ].filter(Boolean).length > 1
  ) {
    throw new Error("Choose one login method: browser/SSO, --email, or --key.");
  }
  if (
    (options.key || options.email !== undefined) &&
    (options.apiUrl || options.dashboardUrl || options.gatewayUrl)
  ) {
    throw new Error(
      "For --email or --key, configure deployment URLs using LLMGATEWAY_API_URL, LLMGATEWAY_ORIGIN_URL and LLMGATEWAY_GATEWAY_URL.",
    );
  }
  if (options.email !== undefined) {
    await loginWithEmail(
      typeof options.email === "string" ? options.email : undefined,
    );
  } else if (options.key) {
    await loginWithApiKey();
  } else {
    await loginWithBrowser(options);
  }
  if (options.org)
    await setConfig({
      defaultOrgId: await resolveOrgId(options.org),
      defaultProjectId: undefined,
    });
}

async function saveSession(updates: Partial<Config>): Promise<void> {
  const current = await getConfig();
  const changedAccount =
    current.sessionEmail !== updates.sessionEmail ||
    current.sessionApiUrl !== updates.sessionApiUrl;
  await setConfig({
    ...(changedAccount
      ? {
          defaultOrgId: undefined,
          defaultProjectId: undefined,
          apiKey: undefined,
        }
      : {}),
    sessionCookie: undefined,
    sessionToken: undefined,
    ...updates,
  });
}

async function loginWithBrowser(options: LoginOptions): Promise<void> {
  const apiUrl = normalizeUrl(options.apiUrl ?? (await getApiUrl()));
  const dashboardUrl = normalizeUrl(
    options.dashboardUrl ?? (await getDashboardUrl()),
  );
  if (
    options.apiUrl &&
    process.env.LLMGATEWAY_API_URL &&
    normalizeUrl(process.env.LLMGATEWAY_API_URL) !== apiUrl
  ) {
    throw new Error(
      "--api-url conflicts with LLMGATEWAY_API_URL. Update or unset the environment override first.",
    );
  }
  const gatewayUrl = options.gatewayUrl
    ? normalizeUrl(options.gatewayUrl)
    : undefined;
  const timeoutMs =
    options.timeout === undefined ? undefined : Number(options.timeout) * 1000;
  const controller = new AbortController();
  const cancel = () =>
    controller.abort(new Error("Login cancelled. No credentials were saved."));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const token = await deviceLogin({
      apiUrl,
      dashboardUrl,
      timeoutMs,
      signal: controller.signal,
      onCode: async (code) => {
        const url = verificationUrl(code, dashboardUrl, options.sso);
        logger.log(`Open ${highlight(url)}`);
        logger.log(
          `Confirm this code in your browser: ${bold(code.user_code)}`,
        );
        if (options.browser !== false) {
          await open(url).catch(() =>
            logger.warn(
              "Could not open a browser. Open the URL above on a device where you can sign in.",
            ),
          );
        }
        logger.log(dim("Waiting for browser approval…"));
      },
    });
    const response = await fetch(`${apiUrl}/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok)
      throw new Error(
        "The browser session could not be verified. No credentials were saved.",
      );
    const session = (await response.json()) as {
      user?: { email?: string };
    } | null;
    if (!session?.user?.email)
      throw new Error(
        "The browser session did not include a user. No credentials were saved.",
      );
    await saveSession({
      sessionToken: token,
      sessionEmail: session.user.email,
      sessionApiUrl: apiUrl,
      apiUrl,
      dashboardUrl,
      ...(gatewayUrl ? { gatewayUrl } : {}),
    });
    logger.success(`Signed in as ${highlight(session.user.email)}.`);
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}

async function loginWithEmail(presetEmail?: string): Promise<void> {
  if (!process.stdin.isTTY)
    throw new Error(
      "Email/password login needs an interactive terminal. Use `auth login --no-browser` for browser authentication from a remote terminal.",
    );
  const answers = await prompts([
    {
      type: presetEmail ? null : "text",
      name: "email",
      message: "Email:",
      validate: (value: string) => value.includes("@") || "Enter a valid email",
    },
    {
      type: "password",
      name: "password",
      message: "Password:",
    },
  ]);

  const email = presetEmail ?? answers.email;
  if (!email || !answers.password) {
    logger.error("Email and password are required.");
    process.exit(1);
  }

  try {
    const { cookie, user } = await signInWithEmail(email, answers.password);
    await saveSession({
      sessionCookie: cookie,
      sessionEmail: user.email,
      sessionApiUrl: await getApiUrl(),
    });

    logger.blank();
    logger.success(`Signed in as ${highlight(user.email)}`);
    logger.log(dim(`Session stored in ${configFile()}`));
    logger.blank();
    logger.log(dim("You can now use:"));
    logger.log(
      dim(`  ${highlight("llmgateway keys create")}     Create API keys`),
    );
    logger.log(
      dim(`  ${highlight("llmgateway budget set")}      Set spending limits`),
    );
    logger.log(
      dim(`  ${highlight("llmgateway usage")}           View usage analytics`),
    );
    logger.blank();
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error(`Sign-in failed: ${error.message}`);
      if (error.status === 401 || error.status === 403) {
        logger.log(
          dim(
            "Use `llmgateway auth login` for browser login, or `llmgateway auth login --sso` if your organization requires SSO.",
          ),
        );
      }
      process.exit(1);
    }
    throw error;
  }
}

async function loginWithApiKey(): Promise<void> {
  if (!process.stdin.isTTY)
    throw new Error(
      "Storing an API key needs an interactive terminal. Set LLMGATEWAY_API_KEY for unattended launches.",
    );
  // Check if already configured via env
  const envKey = getEnvApiKey();
  if (envKey) {
    logger.warn(
      "API key is already set via LLMGATEWAY_API_KEY environment variable.",
    );
    logger.log(
      dim(
        "The stored API key will be used as a fallback when the env var is not set.",
      ),
    );
    logger.blank();
  }

  logger.log("Opening LLM Gateway dashboard to get your API key...");
  logger.blank();

  const keyUrl = `${await getDashboardUrl()}/dashboard/api-keys`;
  await open(keyUrl).catch(() =>
    logger.log(`Open ${keyUrl} to get your API key.`),
  );

  const response = await prompts({
    type: "password",
    name: "apiKey",
    message: "Paste your API key:",
  });

  if (!response.apiKey) {
    logger.error("No API key provided.");
    process.exit(1);
  }

  await setConfig({ apiKey: response.apiKey });

  logger.blank();
  logger.success("API key saved successfully!");
  logger.log(dim(`Stored in ${configFile()}`));
  logger.blank();
}

export async function authStatus(): Promise<void> {
  logger.blank();

  const envKey = getEnvApiKey();
  const config = await getConfig();

  // Dashboard session
  if (config.sessionCookie || config.sessionToken) {
    const user = await getSessionUser();
    if (user) {
      logger.success(
        `Dashboard session: signed in as ${highlight(user.email)}`,
      );
    } else {
      logger.warn(
        `Dashboard session: expired (was ${config.sessionEmail ?? "unknown"})`,
      );
      logger.log(
        dim(`  Run ${highlight("llmgateway auth login")} to sign in again`),
      );
    }
  } else {
    logger.warn("Dashboard session: not signed in");
    logger.log(
      dim(
        `  Run ${highlight("llmgateway auth login")} to enable keys/budget/usage commands`,
      ),
    );
  }

  logger.blank();

  // API key
  if (envKey) {
    logger.success("API key: set via environment variable");
    logger.log(`  ${dim("LLMGATEWAY_API_KEY=")}${highlight(maskKey(envKey))}`);
  } else if (config.apiKey) {
    logger.success("API key: stored in config file");
    logger.log(`  ${dim("API Key:")} ${highlight(maskKey(config.apiKey))}`);
    logger.log(`  ${dim("Config:")} ~/.llmgateway/config.json`);
  } else {
    logger.warn("API key: not set");
    logger.log(
      dim(`  Run ${highlight("llmgateway auth login --key")} to set one`),
    );
  }

  logger.blank();
}

export async function authWhoami(): Promise<void> {
  const user = await getSessionUser();

  if (!user) {
    logger.warn("Not signed in.");
    logger.log(dim(`Run ${highlight("llmgateway auth login")} to sign in.`));
    process.exit(1);
  }

  logger.log(`${user.name ? `${user.name} ` : ""}${dim(`<${user.email}>`)}`);
}

export async function authLogout(): Promise<void> {
  const envKey = getEnvApiKey();

  if (envKey) {
    logger.warn("API key is set via LLMGATEWAY_API_KEY environment variable.");
    logger.log(dim("Remove the environment variable to fully log out."));
    logger.blank();
  }

  try {
    const headers = await sessionHeaders();
    if (Object.keys(headers).length) {
      const response = await fetch(`${await getApiUrl()}/auth/sign-out`, {
        method: "POST",
        headers: {
          ...headers,
          Origin: new URL(await getDashboardUrl()).origin,
          "Content-Type": "application/json",
        },
        body: "{}",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        logger.warn(
          "Could not revoke the remote session. Local credentials will still be removed.",
        );
    }
  } catch {
    logger.warn(
      "Could not reach the session's server. Local credentials will still be removed.",
    );
  } finally {
    await clearConfig();
  }
  logger.success(
    "Logged out. Stored credentials removed; deployment settings and custom agents retained.",
  );
  logger.blank();
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
