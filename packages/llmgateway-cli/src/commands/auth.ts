import prompts from "prompts";
import open from "open";
import { logger, highlight, dim, bold } from "../utils/logger.js";
import { getConfig, setConfig, clearConfig, getEnvApiKey } from "../utils/config.js";

export async function authLogin(): Promise<void> {
  logger.blank();
  logger.log(bold("LLM Gateway Authentication"));
  logger.blank();

  // Check if already configured via env
  const envKey = getEnvApiKey();
  if (envKey) {
    logger.warn("API key is already set via LLMGATEWAY_API_KEY environment variable.");
    logger.log(dim("The stored API key will be used as a fallback when the env var is not set."));
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

  if (envKey) {
    logger.success("Authenticated via environment variable");
    logger.log(`  ${dim("LLMGATEWAY_API_KEY=")}${highlight(maskKey(envKey))}`);
  } else if (config.apiKey) {
    logger.success("Authenticated via config file");
    logger.log(`  ${dim("API Key:")} ${highlight(maskKey(config.apiKey))}`);
    logger.log(`  ${dim("Config:")} ~/.llmgateway/config.json`);
  } else {
    logger.warn("Not authenticated");
    logger.log(dim(`Run ${highlight("npx @llmgateway/cli auth login")} to authenticate`));
  }

  logger.blank();
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
