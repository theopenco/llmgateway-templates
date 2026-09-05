import spawn from "cross-spawn";
import { writePrivateJson } from "./config.js";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { readJsonConfig, syncOpencodeModelCatalog } from "./agent-configs.js";
import { logger, highlight, dim } from "./logger.js";

export const DEFAULT_GATEWAY_URL = "https://api.llmgateway.io";

export interface LaunchContext {
  /** LLM Gateway API key (llmgtwy_...) */
  apiKey: string;
  /** Gateway base URL without trailing slash, e.g. https://api.llmgateway.io */
  gatewayUrl: string;
  /** Optional model id from --model */
  model?: string;
  /** Resolved executable (absolute path when found outside PATH) */
  bin: string;
}

export interface AgentDefinition {
  /** Primary launch name: `llmgateway launch <id>` / `llmgateway <id>` */
  id: string;
  /** Alternate launch names */
  aliases?: string[];
  label: string;
  description: string;
  /** Executable to spawn */
  bin: string;
  /**
   * Extra locations to look for the binary when it's not on PATH
   * (e.g. CLIs bundled by desktop apps). `~` expands to the home dir.
   */
  binPaths?: string[];
  /** Shown when the binary is missing */
  installCommand?: string;
  installUrl: string;
  guideUrl: string;
  /** Whether --model maps onto the agent's model setting */
  supportsModel: boolean;
  /** Shown when models are picked inside the agent instead */
  modelHint?: string;
  /** Extra environment variables for the agent process */
  env?: (ctx: LaunchContext) => Record<string, string>;
  /** Args injected before user-provided passthrough args */
  args?: (ctx: LaunchContext, passthrough: string[]) => string[];
  /** One-line summary of what prepare() does (shown in --dry-run) */
  prepareSummary?: string;
  /** Config-file setup or key registration, run before spawning */
  prepare?: (ctx: LaunchContext) => Promise<void>;
}

function homeFile(...segments: string[]): string {
  return path.join(os.homedir(), ...segments);
}

/**
 * Registers the key with Empryo/SoulForge via their documented
 * `--set-key llmgateway <key>` flag. Idempotent, so it runs on every launch
 * and picks up rotated keys.
 */
function setKeyViaFlag(ctx: LaunchContext): void {
  if (ctx.gatewayUrl !== DEFAULT_GATEWAY_URL) {
    throw new Error(
      "This agent’s built-in LLM Gateway provider uses the hosted gateway. Register a custom agent definition for your enterprise endpoint.",
    );
  }
  const result = spawn.sync(ctx.bin, ["--set-key", "llmgateway", ctx.apiKey], {
    stdio: "ignore",
  });
  if (result.status !== 0) {
    logger.warn(
      `Could not register the key automatically. Inside the agent, type ${highlight("/keys")} and paste your LLM Gateway key.`,
    );
  } else {
    logger.log(dim(`Registered LLM Gateway key via --set-key.`));
  }
}

/**
 * Refreshes the llmgateway entry in an opencode-family auth store
 * (`~/.local/share/<tool>/auth.json`). These tools prefer their stored
 * credential over the LLMGATEWAY_API_KEY env var, so a stale entry from an
 * earlier /connect would otherwise override the launcher's key.
 */
async function upsertOpencodeAuth(tool: string, key: string): Promise<void> {
  const dataHome =
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  const file = path.join(dataHome, tool, "auth.json");
  const auth = (await readJsonConfig(file)) ?? {};
  const existing = auth.llmgateway;
  if (existing?.type === "api" && existing.key === key) {
    return;
  }
  auth.llmgateway = { type: "api", key };
  await writePrivateJson(file, auth);
  logger.log(dim(`Refreshed the llmgateway credential in ${file}`));
}

const PI_DEFAULT_MODELS = [
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
  { id: "claude-opus-5", name: "Claude Opus 5" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", reasoning: true },
];

async function preparePi(ctx: LaunchContext): Promise<void> {
  const file = homeFile(".pi", "agent", "models.json");
  const config = (await readJsonConfig(file)) ?? {};
  config.providers ??= {};
  if (!config.providers.llmgateway) {
    config.providers.llmgateway = {
      baseUrl: `${ctx.gatewayUrl}/v1`,
      api: "openai-completions",
      // Pi resolves this as an env var name; the launcher sets it.
      apiKey: "LLM_GATEWAY_API_KEY",
      models: [...PI_DEFAULT_MODELS],
    };
    logger.log(dim(`Added the llmgateway provider to ${file}`));
  }
  config.providers.llmgateway.baseUrl = `${ctx.gatewayUrl}/v1`;
  config.providers.llmgateway.api = "openai-completions";
  config.providers.llmgateway.apiKey = "LLM_GATEWAY_API_KEY";
  const models: { id: string; name?: string }[] =
    (config.providers.llmgateway.models ??= []);
  if (ctx.model && !models.some((m) => m.id === ctx.model)) {
    models.push({ id: ctx.model, name: ctx.model });
  }
  await writePrivateJson(file, config);
}

const MIMO_DEFAULT_MODELS = [
  "claude-opus-5",
  "gpt-5.6-sol",
  "deepseek-v4-pro",
  "qwen3.8-max",
];

async function prepareMimo(ctx: LaunchContext): Promise<void> {
  const file = homeFile(".config", "mimocode", "mimocode.json");
  const existing = await readJsonConfig(file);
  const config = existing ?? {};
  config.provider ??= {};
  config.provider.anthropic ??= {};
  config.provider.anthropic.options = {
    ...config.provider.anthropic.options,
    apiKey: ctx.apiKey,
    baseURL: `${ctx.gatewayUrl}/v1`,
  };
  const models: Record<string, { name: string }> =
    (config.provider.anthropic.models ??= {});
  for (const id of MIMO_DEFAULT_MODELS) {
    models[id] ??= { name: id };
  }
  if (ctx.model) {
    models[ctx.model] ??= { name: ctx.model };
    config.model = `anthropic/${ctx.model}`;
  } else if (!existing) {
    config.model = `anthropic/${MIMO_DEFAULT_MODELS[0]}`;
  }
  await writePrivateJson(file, config);
  logger.log(dim(`Routed MiMo Code through LLM Gateway in ${file}`));
}

const OPENCLAW_DEFAULT_MODELS = [
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    contextWindow: 1050000,
    maxTokens: 32000,
  },
  {
    id: "claude-opus-5",
    name: "Claude Opus 5",
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    contextWindow: 1048576,
    maxTokens: 8192,
  },
];

async function prepareOpenClaw(ctx: LaunchContext): Promise<void> {
  const file = homeFile(".openclaw", "openclaw.json");
  const existing = await readJsonConfig(file);
  const config = existing ?? {};
  config.models ??= {};
  config.models.mode ??= "merge";
  config.models.providers ??= {};
  const provider = (config.models.providers.llmgateway ??= {});
  provider.baseUrl = `${ctx.gatewayUrl}/v1`;
  provider.apiKey = "${LLMGATEWAY_API_KEY}";
  provider.api = "openai-completions";
  provider.models ??= [...OPENCLAW_DEFAULT_MODELS];
  if (
    ctx.model &&
    !provider.models.some((m: { id: string }) => m.id === ctx.model)
  ) {
    provider.models.push({ id: ctx.model, name: ctx.model });
  }
  if (ctx.model) {
    config.agents ??= {};
    config.agents.defaults ??= {};
    config.agents.defaults.model ??= {};
    config.agents.defaults.model.primary = `llmgateway/${ctx.model}`;
  } else if (!existing) {
    config.agents = {
      defaults: {
        model: { primary: `llmgateway/${OPENCLAW_DEFAULT_MODELS[0].id}` },
      },
    };
  }
  await writePrivateJson(file, config);
  logger.log(dim(`Added the llmgateway provider to ${file}`));
}

/** Runtime overrides take precedence over stored credentials and project config. */
function opencodeEnv(ctx: LaunchContext): Record<string, string> {
  const content: unknown = JSON.parse(
    process.env.OPENCODE_CONFIG_CONTENT ?? "{}",
  );
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("OPENCODE_CONFIG_CONTENT must contain a JSON object");
  }
  const config = content as import("./agent-configs.js").AgentConfig;
  config.provider ??= {};
  config.provider.llmgateway ??= {};
  config.provider.llmgateway.options = {
    ...config.provider.llmgateway.options,
    baseURL: `${ctx.gatewayUrl}/v1`,
    apiKey: ctx.apiKey,
  };
  return {
    LLMGATEWAY_API_KEY: ctx.apiKey,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
  };
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "aider",
    label: "Aider",
    description: "Pair programming in your terminal",
    bin: "aider",
    installCommand: "uv tool install --python python3.12 aider-chat",
    installUrl: "https://aider.chat/docs/install.html",
    guideUrl: "https://aider.chat/docs/llms/openai-compat.html",
    supportsModel: true,
    env: (ctx) => ({
      OPENAI_API_KEY: ctx.apiKey,
      OPENAI_API_BASE: `${ctx.gatewayUrl}/v1`,
    }),
    args: (ctx) => ["--model", `openai/${ctx.model ?? "gpt-5.4"}`],
  },
  {
    id: "qwen",
    aliases: ["qwen-code"],
    label: "Qwen Code",
    description: "Qwen's open-source terminal coding agent",
    bin: "qwen",
    installCommand: "npm install -g @qwen-code/qwen-code",
    installUrl: "https://qwenlm.github.io/qwen-code-docs/",
    guideUrl:
      "https://qwenlm.github.io/qwen-code-docs/en/users/configuration/auth/",
    supportsModel: true,
    env: (ctx) => ({
      OPENAI_API_KEY: ctx.apiKey,
      OPENAI_BASE_URL: `${ctx.gatewayUrl}/v1`,
    }),
    args: (ctx) => ["--auth-type", "openai", "--model", ctx.model ?? "gpt-5.4"],
  },
  {
    id: "goose",
    label: "Goose",
    description: "Extensible coding agent with MCP tools",
    bin: "goose",
    installCommand: "brew install goose-cli",
    installUrl: "https://github.com/block/goose",
    guideUrl:
      "https://github.com/block/goose/blob/main/documentation/docs/getting-started/providers.md",
    supportsModel: true,
    env: (ctx) => ({
      GOOSE_PROVIDER: "openai",
      GOOSE_MODEL: ctx.model ?? "gpt-5.4",
      OPENAI_API_KEY: ctx.apiKey,
      OPENAI_HOST: ctx.gatewayUrl,
    }),
    args: (_ctx, passthrough) => (passthrough.length ? [] : ["session"]),
  },
  {
    id: "devpass-code",
    aliases: ["devpass"],
    label: "DevPass Code",
    description: "First-party terminal agent built for LLM Gateway",
    bin: "devpass-code",
    installCommand: "npm install -g devpass-code",
    installUrl: "https://llmgateway.io/guides/devpass-code",
    guideUrl: "https://llmgateway.io/guides/devpass-code",
    supportsModel: true,
    modelHint:
      "DevPass Code has a curated catalog (e.g. gpt-5.4-nano) — every gateway model is a keystroke away in the picker.",
    env: opencodeEnv,
    args: (ctx) => ["--model", `llmgateway/${ctx.model ?? "gpt-5.4"}`],
    prepareSummary:
      "refresh the llmgateway credential in ~/.local/share/devpass-code/auth.json",
    prepare: (ctx) => upsertOpencodeAuth("devpass-code", ctx.apiKey),
  },
  {
    id: "claude",
    aliases: ["claude-code"],
    label: "Claude Code",
    description: "Anthropic's terminal agent on any LLM Gateway model",
    bin: "claude",
    installCommand: "npm install -g @anthropic-ai/claude-code",
    installUrl: "https://docs.anthropic.com/en/docs/claude-code",
    guideUrl: "https://llmgateway.io/guides/claude-code",
    supportsModel: true,
    modelHint:
      'Type /model inside Claude Code to pick any gateway model (listed as "From gateway").',
    env: (ctx) => ({
      ANTHROPIC_BASE_URL: ctx.gatewayUrl,
      ANTHROPIC_AUTH_TOKEN: ctx.apiKey,
      ANTHROPIC_API_KEY: ctx.apiKey,
      // Fills the /model picker from the gateway's /v1/models catalog.
      CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
      ...(ctx.model ? { ANTHROPIC_MODEL: ctx.model } : {}),
    }),
  },
  {
    id: "opencode",
    label: "OpenCode",
    description: "Open-source terminal agent — LLM Gateway is built in",
    bin: "opencode",
    installCommand: "npm install -g opencode-ai",
    installUrl: "https://opencode.ai/download",
    guideUrl: "https://llmgateway.io/guides/opencode",
    supportsModel: true,
    env: opencodeEnv,
    args: (ctx) => ["--model", `llmgateway/${ctx.model ?? "gpt-5.4"}`],
    prepareSummary:
      "refresh the llmgateway credential in ~/.local/share/opencode/auth.json and sync the provider-pinned model catalog into ~/.config/opencode/opencode.json",
    prepare: async (ctx) => {
      await upsertOpencodeAuth("opencode", ctx.apiKey);
      const result = await syncOpencodeModelCatalog();
      if (result.added > 0 || result.updated > 0) {
        logger.log(
          dim(
            `Synced ${result.total} provider-pinned gateway models into ${result.file}`,
          ),
        );
      }
    },
  },
  {
    id: "empryo",
    label: "Empryo",
    description: "Graph-powered agent that edits symbols, not strings",
    bin: "empryo",
    // The Empryo desktop app installs the CLI here without adding it to PATH.
    binPaths: ["~/.empryo/bin/empryo"],
    installCommand: "curl -fsSL https://empryo.com/install.sh | bash",
    installUrl: "https://empryo.com/download",
    guideUrl: "https://llmgateway.io/guides/empryo",
    supportsModel: false,
    modelHint: "Pick a model inside Empryo (llmgateway provider).",
    prepareSummary: "register key via `empryo --set-key llmgateway <key>`",
    prepare: (ctx) => {
      setKeyViaFlag(ctx);
      return Promise.resolve();
    },
  },
  {
    id: "soulforge",
    label: "SoulForge",
    description: "Empryo's predecessor — same graph engine, still supported",
    bin: "soulforge",
    binPaths: ["~/.soulforge/bin/soulforge", "~/.empryo/bin/soulforge"],
    installCommand: "npm install -g @proxysoul/soulforge",
    installUrl: "https://github.com/proxysoul/soulforge",
    guideUrl: "https://llmgateway.io/guides/soulforge",
    supportsModel: false,
    modelHint: "Pick a model inside SoulForge (llmgateway provider).",
    prepareSummary: "register key via `soulforge --set-key llmgateway <key>`",
    prepare: (ctx) => {
      setKeyViaFlag(ctx);
      return Promise.resolve();
    },
  },
  {
    id: "codex",
    aliases: ["codex-cli"],
    label: "Codex CLI",
    description: "OpenAI's terminal agent routed through LLM Gateway",
    bin: "codex",
    installCommand: "npm install -g @openai/codex",
    installUrl: "https://github.com/openai/codex",
    guideUrl: "https://llmgateway.io/guides/codex-cli",
    supportsModel: true,
    env: (ctx) => ({ LLMGATEWAY_API_KEY: ctx.apiKey }),
    // -c overrides configure the provider per-session without touching
    // ~/.codex/config.toml. Values are TOML, hence the embedded quotes.
    args: (ctx) => [
      "-c",
      `model_provider="llmgateway"`,
      "-c",
      `model_providers.llmgateway.name="LLM Gateway"`,
      "-c",
      `model_providers.llmgateway.base_url=${JSON.stringify(`${ctx.gatewayUrl}/v1`)}`,
      "-c",
      `model_providers.llmgateway.env_key="LLMGATEWAY_API_KEY"`,
      "-c",
      `model_providers.llmgateway.wire_api="responses"`,
      ...(ctx.model ? ["-c", `model=${JSON.stringify(ctx.model)}`] : []),
    ],
  },
  {
    id: "autohand",
    label: "Autohand Code",
    description: "Autonomous coding agent for terminal, IDE, and Slack",
    bin: "autohand",
    installCommand: "npm install -g autohand-cli",
    installUrl: "https://llmgateway.io/guides/autohand",
    guideUrl: "https://llmgateway.io/guides/autohand",
    supportsModel: true,
    env: (ctx) => ({
      OPENAI_BASE_URL: `${ctx.gatewayUrl}/v1`,
      OPENAI_API_KEY: ctx.apiKey,
      ...(ctx.model ? { OPENAI_MODEL: ctx.model } : {}),
    }),
  },
  {
    id: "pi",
    label: "Pi",
    description: "Minimal terminal coding agent",
    bin: "pi",
    installCommand: "npm install -g @mariozechner/pi-coding-agent",
    installUrl: "https://pi.dev",
    guideUrl: "https://llmgateway.io/guides/pi",
    supportsModel: true,
    modelHint: "Type /model inside Pi to switch models.",
    env: (ctx) => ({ LLM_GATEWAY_API_KEY: ctx.apiKey }),
    prepareSummary: "add llmgateway provider to ~/.pi/agent/models.json",
    prepare: preparePi,
    args: (ctx) => [
      "--provider",
      "llmgateway",
      ...(ctx.model ? ["--model", ctx.model] : []),
    ],
  },
  {
    id: "kimi",
    aliases: ["kimi-code"],
    label: "Kimi Code",
    description: "Moonshot AI's open-source terminal agent",
    bin: "kimi",
    installCommand:
      "curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash",
    installUrl: "https://github.com/MoonshotAI/kimi-code",
    guideUrl: "https://llmgateway.io/guides/kimi-code",
    supportsModel: true,
    env: (ctx) => ({
      KIMI_MODEL_NAME: ctx.model ?? "gpt-5.4",
      KIMI_MODEL_API_KEY: ctx.apiKey,
      KIMI_MODEL_PROVIDER_TYPE: "openai",
      KIMI_MODEL_BASE_URL: `${ctx.gatewayUrl}/v1`,
      KIMI_MODEL_CAPABILITIES: "tool_use",
    }),
  },
  {
    id: "mimo",
    aliases: ["mimocode"],
    label: "MiMo Code",
    description: "Xiaomi's AI coding agent CLI",
    bin: "mimo",
    installCommand: "curl -fsSL https://mimo.xiaomi.com/install | bash",
    installUrl: "https://mimo.xiaomi.com/mimocode",
    guideUrl: "https://llmgateway.io/guides/mimocode",
    supportsModel: true,
    prepareSummary:
      "route provider through LLM Gateway in ~/.config/mimocode/mimocode.json",
    prepare: prepareMimo,
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    description: "Chat agents across Discord, WhatsApp, Telegram, and more",
    bin: "openclaw",
    installCommand: "npm install -g openclaw",
    installUrl: "https://llmgateway.io/guides/openclaw",
    guideUrl: "https://llmgateway.io/guides/openclaw",
    supportsModel: true,
    env: (ctx) => ({ LLMGATEWAY_API_KEY: ctx.apiKey }),
    prepareSummary: "add llmgateway provider to ~/.openclaw/openclaw.json",
    prepare: prepareOpenClaw,
  },
  {
    id: "hermes",
    aliases: ["hermes-agent"],
    label: "Hermes Agent",
    description: "Nous Research's agent with tools, skills, and messaging",
    bin: "hermes",
    installCommand:
      "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash",
    installUrl: "https://github.com/nousresearch/hermes-agent",
    guideUrl: "https://llmgateway.io/guides/hermes-agent",
    supportsModel: true,
    modelHint: "Type /model inside Hermes to switch models.",
    env: (ctx) => ({
      LLM_GATEWAY_API_KEY: ctx.apiKey,
      LLMGATEWAY_API_KEY: ctx.apiKey,
    }),
    args: (ctx) => {
      if (ctx.gatewayUrl !== DEFAULT_GATEWAY_URL) {
        throw new Error(
          "Hermes' built-in LLM Gateway provider uses the hosted gateway. Register a custom agent definition for an enterprise-configured Hermes profile.",
        );
      }
      return ["--provider", "llmgateway", "--model", ctx.model ?? "gpt-5.4"];
    },
  },
];

export function findAgent(name: string): AgentDefinition | undefined {
  const normalized = name.toLowerCase();
  return AGENTS.find(
    (agent) => agent.id === normalized || agent.aliases?.includes(normalized),
  );
}

/**
 * Finds the agent executable: PATH first, then any binPaths fallbacks
 * (CLIs bundled by desktop apps). Returns the spawnable command — the bare
 * name when on PATH, an absolute path otherwise — or undefined when missing.
 */
export function resolveAgentBin(agent: AgentDefinition): string | undefined {
  const checker = process.platform === "win32" ? "where" : "which";
  if (spawn.sync(checker, [agent.bin], { stdio: "ignore" }).status === 0) {
    return agent.bin;
  }
  for (const candidate of agent.binPaths ?? []) {
    const resolved = candidate.startsWith("~")
      ? path.join(os.homedir(), candidate.slice(1))
      : candidate;
    try {
      fs.accessSync(resolved, fs.constants.X_OK);
      return resolved;
    } catch {
      // not there — try the next candidate
    }
  }
  return undefined;
}

export function isAgentInstalled(agent: AgentDefinition): boolean {
  return resolveAgentBin(agent) !== undefined;
}
