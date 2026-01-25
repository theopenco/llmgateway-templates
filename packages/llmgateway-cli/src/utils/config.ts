import fs from "fs-extra";
import path from "path";
import os from "os";

export interface Config {
  apiKey?: string;
  defaultTemplate?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".llmgateway");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export async function getConfig(): Promise<Config> {
  try {
    if (await fs.pathExists(CONFIG_FILE)) {
      return await fs.readJson(CONFIG_FILE);
    }
  } catch {
    // Return empty config if file is corrupted
  }
  return {};
}

export async function setConfig(updates: Partial<Config>): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  const current = await getConfig();
  const updated = { ...current, ...updates };
  await fs.writeJson(CONFIG_FILE, updated, { spaces: 2 });
}

export async function clearConfig(): Promise<void> {
  if (await fs.pathExists(CONFIG_FILE)) {
    await fs.remove(CONFIG_FILE);
  }
}

export function getEnvApiKey(): string | undefined {
  return process.env.LLMGATEWAY_API_KEY;
}

export async function getApiKey(): Promise<string | undefined> {
  // Environment variable takes precedence
  const envKey = getEnvApiKey();
  if (envKey) return envKey;

  // Fall back to config file
  const config = await getConfig();
  return config.apiKey;
}
