import prompts from "prompts";
import open from "open";
import { logger, highlight, dim, bold } from "../utils/logger.js";
import {
  getConfig,
  setConfig,
  clearConfig,
  getEnvApiKey,
} from "../utils/config.js";
import { signInWithEmail, getSessionUser, ApiError } from "../utils/api.js";

interface LoginOptions {
  key?: boolean;
  /** --email may be a bare flag (true) or carry a value */
  email?: string | boolean;
}

export async function authLogin(options: LoginOptions = {}): Promise<void> {
  logger.blank();
  logger.log(bold("LLM Gateway Authentication"));
  logger.blank();

  let method: "email" | "key" | undefined = options.key
    ? "key"
    : options.email !== undefined
      ? "email"
      : undefined;

  if (!method) {
    const answer = await prompts({
      type: "select",
      name: "method",
      message: "How do you want to authenticate?",
      choices: [
        {
          title: "Email & password",
          description:
            "Full access: manage API keys, budgets, and usage analytics",
          value: "email",
        },
        {
          title: "Paste an API key",
          description: "Gateway requests only (chat, completions, images)",
          value: "key",
        },
      ],
    });
    if (!answer.method) {
      process.exit(1);
    }
    method = answer.method;
  }

  if (method === "email") {
    await loginWithEmail(
      typeof options.email === "string" ? options.email : undefined,
    );
  } else {
    await loginWithApiKey();
  }
}

async function loginWithEmail(presetEmail?: string): Promise<void> {
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
    await setConfig({ sessionCookie: cookie, sessionEmail: user.email });

    logger.blank();
    logger.success(`Signed in as ${highlight(user.email)}`);
    logger.log(dim("Session stored in ~/.llmgateway/config.json"));
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
            "If you signed up with GitHub/Google, set a password first at https://llmgateway.io/dashboard/settings",
          ),
        );
      }
      process.exit(1);
    }
    throw error;
  }
}

async function loginWithApiKey(): Promise<void> {
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

  await open("https://llmgateway.io/dashboard/api-keys");

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
  logger.log(dim(`Stored in ~/.llmgateway/config.json`));
  logger.blank();
}

export async function authStatus(): Promise<void> {
  logger.blank();

  const envKey = getEnvApiKey();
  const config = await getConfig();

  // Dashboard session
  if (config.sessionCookie) {
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

  await clearConfig();
  logger.success("Logged out successfully. Config file removed.");
  logger.blank();
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
