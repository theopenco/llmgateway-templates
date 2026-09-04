import spawn from "cross-spawn";
import { constants } from "node:os";
import open from "open";
import prompts from "prompts";
import {
  isAgentInstalled,
  resolveAgentBin,
  type AgentDefinition,
  type LaunchContext,
} from "../utils/agents.js";
import {
  getConfig,
  setConfig,
  getEnvApiKey,
  getGatewayUrl,
  getDashboardUrl,
  configFile,
} from "../utils/config.js";
import { getAgents } from "../utils/custom-agents.js";
import { logger, highlight, dim, bold } from "../utils/logger.js";

export interface LaunchOptions {
  model?: string;
  key?: string;
  gatewayUrl?: string;
  dryRun?: boolean;
  list?: boolean;
  checkKey?: boolean;
}

export async function launch(
  agentName: string | undefined,
  passthrough: string[] = [],
  options: LaunchOptions = {},
): Promise<void> {
  const agents = await getAgents();
  if (options.list) {
    printAgentList(agents);
    return;
  }

  let agent: AgentDefinition | undefined;
  if (agentName) {
    const name = agentName.toLowerCase();
    agent = agents.find(
      (entry) => entry.id === name || entry.aliases?.includes(name),
    );
    if (!agent) {
      logger.error(`Unknown agent: ${agentName}`);
      logger.blank();
      printAgentList(agents);
      process.exit(1);
    }
  } else {
    agent = await pickAgent(agents);
  }

  const resolvedBin = resolveAgentBin(agent);
  if (!options.dryRun && !resolvedBin) {
    logger.error(
      `${agent.label} is not installed (missing ${highlight(agent.bin)} binary).`,
    );
    logger.blank();
    if (agent.installCommand) {
      logger.log(`Install it with:`);
      logger.log(`  ${highlight(agent.installCommand)}`);
      logger.blank();
    }
    logger.log(dim(`Docs: ${agent.installUrl}`));
    process.exit(1);
  }

  const gatewayUrl = await getGatewayUrl(options.gatewayUrl);

  const apiKey = await resolveApiKey(options, gatewayUrl);

  const ctx: LaunchContext = {
    apiKey,
    gatewayUrl,
    model: options.model,
    bin: resolvedBin ?? agent.bin,
  };

  if (options.model && !agent.supportsModel) {
    logger.warn(
      `${agent.label} selects models in-app; ignoring --model ${options.model}.`,
    );
    if (agent.modelHint) {
      logger.log(dim(agent.modelHint));
    }
    ctx.model = undefined;
  }

  const env = agent.env?.(ctx) ?? {};
  const args = [...(agent.args?.(ctx, passthrough) ?? []), ...passthrough];

  if (options.dryRun) {
    logger.blank();
    logger.log(bold(`Would launch ${agent.label}:`));
    logger.log(
      `  ${highlight([ctx.bin, ...args].map((arg) => JSON.stringify(arg.replaceAll(apiKey, "[REDACTED]"))).join(" "))}`,
    );
    const envKeys = Object.keys(env);
    if (envKeys.length > 0) {
      logger.log(dim(`  env: ${envKeys.join(", ")}`));
    }
    if (agent.prepareSummary) {
      logger.log(dim(`  setup: ${agent.prepareSummary}`));
    }
    logger.blank();
    return;
  }

  await agent.prepare?.(ctx);

  logger.log(
    dim(
      `Launching ${agent.label} via LLM Gateway (${gatewayUrl}) — usage appears in your dashboard.`,
    ),
  );
  logger.blank();

  process.exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(ctx.bin, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    const onSigint = () => {
      child.kill("SIGINT");
    };
    const onSigterm = () => {
      child.kill("SIGTERM");
    };
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    const cleanup = () => {
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
    };
    child.once("error", (error) => {
      cleanup();
      reject(new Error(`Failed to launch ${agent.label}: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      cleanup();
      resolve(code ?? (signal ? 128 + constants.signals[signal] : 1));
    });
  });
}

function printAgentList(agents: AgentDefinition[]): void {
  logger.log(bold("Supported coding agents:"));
  logger.blank();
  const width = Math.max(...agents.map((a) => a.id.length)) + 2;
  for (const agent of agents) {
    const installed = isAgentInstalled(agent);
    const status = installed ? "" : dim(" (not installed)");
    logger.log(`  ${highlight(agent.id.padEnd(width))}${agent.label}${status}`);
    logger.log(`  ${" ".repeat(width)}${dim(agent.description)}`);
  }
  logger.blank();
  logger.log(
    dim(
      `Launch one with ${highlight("llmgateway launch <agent>")} or ${highlight("llmgateway <agent>")}`,
    ),
  );
  logger.log(dim(`Guides: https://llmgateway.io/guides`));
}

async function pickAgent(agents: AgentDefinition[]): Promise<AgentDefinition> {
  if (!process.stdin.isTTY)
    throw new Error(
      "Specify an agent: llmgateway launch <agent>. Use --list to see choices.",
    );
  const choices = agents.map((agent) => {
    const installed = isAgentInstalled(agent);
    return {
      title: installed
        ? agent.label
        : `${agent.label} ${dim("(not installed)")}`,
      description: agent.description,
      value: agent.id,
    };
  });

  const answer = await prompts({
    type: "select",
    name: "agent",
    message: "Which coding agent do you want to launch?",
    choices,
  });

  if (!answer.agent) {
    process.exit(1);
  }
  return agents.find((agent) => agent.id === answer.agent)!;
}

/**
 * Model used to preflight the key. Must be a real model: the gateway
 * validates the model before auth, so a made-up id would return 400 for
 * valid and invalid keys alike.
 */
const KEY_CHECK_MODEL = "gpt-5.4-nano";

type KeyCheck =
  | { status: "valid" }
  | { status: "invalid"; message?: string }
  | { status: "warning"; message?: string }
  | { status: "unknown" };

/**
 * Sends a 1-token completion to verify the key actually works before
 * handing it to an agent — a stale key otherwise surfaces as a confusing
 * 401 retry loop mid-session.
 */
async function checkApiKey(key: string, gatewayUrl: string): Promise<KeyCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "x-source": "llmgateway-cli",
      },
      body: JSON.stringify({
        model: KEY_CHECK_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: controller.signal,
      redirect: "error",
    });
    if (res.ok) {
      return { status: "valid" };
    }
    const message: string | undefined = await res
      .json()
      .then(
        (body) => (body as { error?: { message?: string } })?.error?.message,
      )
      .catch(() => undefined);
    if (res.status === 401) {
      return { status: "invalid", message };
    }
    if (res.status === 402 || res.status === 403) {
      // Key exists but the account has a plan/credit problem — the agent
      // will surface the same error, so launch anyway with a heads-up.
      return { status: "warning", message };
    }
    return { status: "unknown" };
  } catch {
    // Offline or gateway hiccup — don't block the launch on the probe.
    return { status: "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

interface KeyCandidate {
  key: string;
  source: string;
  fixHint: string;
}

async function resolveApiKey(
  options: LaunchOptions,
  gatewayUrl: string,
): Promise<string> {
  const config = await getConfig();
  const candidates: KeyCandidate[] = [];
  const keyUrl = `${await getDashboardUrl()}/dashboard/api-keys`;
  if (options.key) {
    candidates.push({
      key: options.key,
      source: "the --key flag",
      fixHint: `Pass a key from ${keyUrl}`,
    });
  }
  const envKey = getEnvApiKey();
  if (envKey) {
    candidates.push({
      key: envKey,
      source: "the LLMGATEWAY_API_KEY environment variable",
      fixHint:
        "Update or remove the export from your shell profile (e.g. ~/.zshrc), or run `unset LLMGATEWAY_API_KEY`",
    });
  }
  if (config.apiKey) {
    candidates.push({
      key: config.apiKey,
      source: configFile(),
      fixHint: "Run `llmgateway auth login --key` to store a fresh key",
    });
  }

  if (options.dryRun) {
    // Keep --dry-run offline-safe: report what would be used, skip the probe.
    return candidates[0]?.key ?? "llmgtwy_dry_run_placeholder";
  }

  // Launching should not incur an inference charge just to inspect credentials.
  if (!options.checkKey && candidates.length > 0) return candidates[0].key;

  for (const candidate of candidates) {
    const check = await checkApiKey(candidate.key, gatewayUrl);
    switch (check.status) {
      case "valid":
        logger.log(dim(`API key OK (from ${candidate.source}).`));
        return candidate.key;
      case "warning":
        logger.warn(
          `API key from ${candidate.source} works, but the gateway reported: ${check.message ?? "a plan or credit issue"}`,
        );
        return candidate.key;
      case "unknown":
        logger.log(
          dim(
            `Could not verify the API key (from ${candidate.source}) — continuing.`,
          ),
        );
        return candidate.key;
      case "invalid":
        logger.error(
          `The API key from ${candidate.source} is invalid: ${check.message ?? "the gateway rejected it"}`,
        );
        logger.log(dim(`  Fix: ${candidate.fixHint}`));
        throw new Error(
          "The selected API key was rejected. Update it before launching.",
        );
    }
  }

  if (!process.stdin.isTTY) {
    logger.error(
      "No working LLM Gateway API key found. Set LLMGATEWAY_API_KEY, pass --key, or run `llmgateway auth login --key`.",
    );
    process.exit(1);
  }

  logger.blank();
  logger.log(
    bold(
      candidates.length > 0
        ? "Let's set up a working API key."
        : "No LLM Gateway API key configured yet.",
    ),
  );
  logger.log("Opening the dashboard so you can create one...");
  logger.blank();

  await open(keyUrl).catch(() => {
    logger.log(dim(`Get a key at ${keyUrl}`));
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await prompts({
      type: "password",
      name: "apiKey",
      message: "Paste your API key:",
    });
    if (!response.apiKey) {
      logger.error("No API key provided.");
      process.exit(1);
    }
    const check: KeyCheck = options.checkKey
      ? await checkApiKey(response.apiKey, gatewayUrl)
      : { status: "unknown" };
    if (check.status === "invalid") {
      logger.error(
        `That key was rejected: ${check.message ?? "the gateway could not find it"}`,
      );
      continue;
    }
    if (check.status === "warning") {
      logger.warn(`Heads-up from the gateway: ${check.message}`);
    }
    await setConfig({ apiKey: response.apiKey });
    logger.success(`API key saved to ${configFile()}`);
    logger.blank();
    return response.apiKey;
  }

  logger.error("Could not validate an API key after 3 attempts.");
  process.exit(1);
}
