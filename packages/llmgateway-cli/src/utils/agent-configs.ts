import { models, providers, type ModelDefinition } from "@llmgateway/models";
import fs from "fs-extra";
import os from "os";
import path from "path";

// The package publishes `models` as a giant literal tuple, where optional
// fields only type-exist on the entries that set them — widen to the
// interface to work with the data generically.
const allModels = models as unknown as ModelDefinition[];
const allProviders = providers as unknown as { id: string; name?: string }[];

/** External agent config files have no schema, so values stay untyped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentConfig = Record<string, any>;

export async function readJsonConfig(
  file: string,
): Promise<AgentConfig | undefined> {
  if (!(await fs.pathExists(file))) {
    return undefined;
  }
  try {
    return await fs.readJson(file);
  } catch {
    throw new Error(
      `${file} exists but is not valid JSON. Fix or remove it, then retry.`,
    );
  }
}

/** One gateway model pinned to one upstream provider (`anthropic/claude-sonnet-5`). */
export interface CodingModelPair {
  /** Root gateway model id, e.g. `claude-sonnet-5` */
  modelId: string;
  /** Human name, e.g. `Claude Sonnet 5` */
  modelName: string;
  /** Upstream provider id, e.g. `aws-bedrock` */
  providerId: string;
  /** Provider display name, e.g. `AWS Bedrock` */
  providerName: string;
  contextSize?: number;
  maxOutput?: number;
  /** USD per token */
  inputPrice?: number;
  outputPrice?: number;
  cachedInputPrice?: number;
  reasoning: boolean;
  vision: boolean;
}

function isActive(mapping: {
  deprecatedAt?: Date;
  deactivatedAt?: Date;
  stability?: string;
}): boolean {
  const now = new Date();
  if (mapping.deactivatedAt && new Date(mapping.deactivatedAt) <= now) {
    return false;
  }
  if (mapping.deprecatedAt && new Date(mapping.deprecatedAt) <= now) {
    return false;
  }
  return (
    mapping.stability !== "unstable" && mapping.stability !== "experimental"
  );
}

/** Prices are published as strings (e.g. "2.0e-6" USD per token). */
function parsePrice(price?: string): number | undefined {
  if (price === undefined) {
    return undefined;
  }
  const value = Number(price);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Every active provider mapping of every coding-capable gateway model:
 * text output, tool calling, streaming, not deprecated or unstable.
 */
export function getCodingModelPairs(): CodingModelPair[] {
  const providerNames = new Map(allProviders.map((p) => [p.id, p.name]));
  const pairs: CodingModelPair[] = [];
  for (const model of allModels) {
    // `custom` and `auto` are gateway pseudo-models with no provider to pin.
    if (model.family === "llmgateway") {
      continue;
    }
    const output = model.output ?? ["text"];
    if (!output.includes("text")) {
      continue;
    }
    if (!isActive(model)) {
      continue;
    }
    for (const mapping of model.providers) {
      if (!mapping.tools || !mapping.streaming || !isActive(mapping)) {
        continue;
      }
      pairs.push({
        modelId: model.id,
        modelName: model.name ?? model.id,
        providerId: mapping.providerId,
        providerName:
          providerNames.get(mapping.providerId) ?? mapping.providerId,
        contextSize: mapping.contextSize,
        maxOutput: mapping.maxOutput,
        inputPrice: parsePrice(mapping.inputPrice),
        outputPrice: parsePrice(mapping.outputPrice),
        cachedInputPrice: parsePrice(mapping.cachedInputPrice),
        reasoning: mapping.reasoning === true,
        vision: mapping.vision === true,
      });
    }
  }
  return pairs;
}

/** USD per token -> USD per million tokens (opencode's cost unit). */
function perMillion(price: number): number {
  return Number((price * 1_000_000).toFixed(4));
}

/**
 * Model entries for opencode's `provider.llmgateway.models` map, keyed by
 * the gateway's provider-pinning syntax (`anthropic/claude-sonnet-5`).
 * opencode merges these with its built-in LLM Gateway provider, so they
 * appear in the model picker next to the root model ids.
 */
export function buildOpencodeModelEntries(): Record<string, AgentConfig> {
  const entries: Record<string, AgentConfig> = {};
  for (const pair of getCodingModelPairs()) {
    const entry: AgentConfig = {
      name: `${pair.modelName} (${pair.providerName})`,
      tool_call: true,
      reasoning: pair.reasoning,
      attachment: pair.vision,
    };
    if (pair.contextSize && pair.maxOutput) {
      entry.limit = { context: pair.contextSize, output: pair.maxOutput };
    }
    if (pair.inputPrice !== undefined && pair.outputPrice !== undefined) {
      entry.cost = {
        input: perMillion(pair.inputPrice),
        output: perMillion(pair.outputPrice),
        ...(pair.cachedInputPrice !== undefined
          ? { cache_read: perMillion(pair.cachedInputPrice) }
          : {}),
      };
    }
    entries[`${pair.providerId}/${pair.modelId}`] = entry;
  }
  return entries;
}

export function opencodeGlobalConfigFile(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "opencode", "opencode.json");
}

export interface OpencodeSyncResult {
  file: string;
  total: number;
  added: number;
  updated: number;
}

/**
 * Merges the pinned-model catalog into the global opencode config.
 * Only `provider.llmgateway.models` entries generated here are touched;
 * everything else in the file (including user-added models) is preserved.
 * opencode also reads `opencode.jsonc` and merges both files, so a
 * hand-written jsonc config keeps working next to this generated one.
 */
export async function syncOpencodeModelCatalog(): Promise<OpencodeSyncResult> {
  const file = opencodeGlobalConfigFile();
  const config = (await readJsonConfig(file)) ?? {
    $schema: "https://opencode.ai/config.json",
  };
  config.provider ??= {};
  config.provider.llmgateway ??= {};
  const modelMap: Record<string, AgentConfig> =
    (config.provider.llmgateway.models ??= {});

  let added = 0;
  let updated = 0;
  const entries = buildOpencodeModelEntries();
  for (const [id, entry] of Object.entries(entries)) {
    const existing = modelMap[id];
    if (!existing) {
      modelMap[id] = entry;
      added++;
    } else if (JSON.stringify(existing) !== JSON.stringify(entry)) {
      modelMap[id] = entry;
      updated++;
    }
  }

  if (added > 0 || updated > 0) {
    await fs.ensureDir(path.dirname(file));
    await fs.writeJson(file, config, { spaces: 2 });
  }
  return { file, total: Object.keys(entries).length, added, updated };
}

export function claudeSettingsFile(scope: "user" | "project"): string {
  if (scope === "project") {
    // settings.local.json: per-user, auto-gitignored — the API key stays
    // out of version control.
    return path.join(process.cwd(), ".claude", "settings.local.json");
  }
  const configDir =
    process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
  return path.join(configDir, "settings.json");
}

export interface ClaudeGatewayOptions {
  gatewayUrl: string;
  apiKey: string;
  scope: "user" | "project";
}

/**
 * Points Claude Code at LLM Gateway and turns on gateway model discovery:
 * Claude Code then loads the gateway's /v1/models catalog into its /model
 * picker (entries show as "From gateway"). Existing settings are preserved;
 * only the three env keys are set.
 */
export async function writeClaudeGatewaySettings(
  options: ClaudeGatewayOptions,
): Promise<{ file: string }> {
  const file = claudeSettingsFile(options.scope);
  const settings = (await readJsonConfig(file)) ?? {};
  settings.env = {
    ...settings.env,
    ANTHROPIC_BASE_URL: options.gatewayUrl,
    ANTHROPIC_AUTH_TOKEN: options.apiKey,
    CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
  };
  await fs.ensureDir(path.dirname(file));
  await fs.writeJson(file, settings, { spaces: 2, mode: 0o600 });
  return { file };
}

/**
 * Claude Code only lists gateway models whose id starts with `claude` or
 * `anthropic` in its /model picker; everything else is filtered out.
 * Used to tell the user what to expect after configuring.
 */
export function countClaudeVisibleModels(): {
  visible: number;
  total: number;
} {
  const ids = new Set(getCodingModelPairs().map((pair) => pair.modelId));
  let visible = 0;
  for (const id of ids) {
    const lower = id.toLowerCase();
    if (lower.startsWith("claude") || lower.startsWith("anthropic")) {
      visible++;
    }
  }
  return { visible, total: ids.size };
}
