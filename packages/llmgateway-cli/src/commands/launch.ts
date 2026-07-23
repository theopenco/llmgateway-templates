import { spawn } from "child_process";
import open from "open";
import prompts from "prompts";
import {
  AGENTS,
  DEFAULT_GATEWAY_URL,
  findAgent,
  isAgentInstalled,
  type AgentDefinition,
  type LaunchContext,
} from "../utils/agents.js";
import { getConfig, setConfig, getEnvApiKey } from "../utils/config.js";
import { logger, highlight, dim, bold } from "../utils/logger.js";

export interface LaunchOptions {
  model?: string;
  key?: string;
  gatewayUrl?: string;
  dryRun?: boolean;
  list?: boolean;
}

export async function launch(
  agentName: string | undefined,
  passthrough: string[] = [],
  options: LaunchOptions = {},
): Promise<void> {
  if (options.list) {
    printAgentList();
    return;
  }

  let agent: AgentDefinition | undefined;
  if (agentName) {
    agent = findAgent(agentName);
    if (!agent) {
      logger.error(`Unknown agent: ${agentName}`);
      logger.blank();
      printAgentList();
      process.exit(1);
    }
  } else {
    agent = await pickAgent();
  }

  if (!options.dryRun && !isAgentInstalled(agent)) {
    logger.error(`${agent.label} is not installed (missing ${highlight(agent.bin)} binary).`);
    logger.blank();
    if (agent.installCommand) {
      logger.log(`Install it with:`);
      logger.log(`  ${highlight(agent.installCommand)}`);
      logger.blank();
    }
    logger.log(dim(`Docs: ${agent.installUrl}`));
    process.exit(1);
  }

  const apiKey = await resolveApiKey(options);
  const gatewayUrl = (
    options.gatewayUrl ??
    process.env.LLMGATEWAY_GATEWAY_URL ??
    DEFAULT_GATEWAY_URL
  ).replace(/\/$/, "");

  const ctx: LaunchContext = { apiKey, gatewayUrl, model: options.model };

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
    logger.log(`  ${highlight([agent.bin, ...args].join(" "))}`);
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

  const child = spawn(agent.bin, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });

  // Let the agent own Ctrl+C; the launcher exits when the child does.
  const onSigint = () => {};
  process.on("SIGINT", onSigint);

  child.on("error", (error) => {
    logger.error(`Failed to launch ${agent.bin}: ${error.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.removeListener("SIGINT", onSigint);
    process.exit(code ?? 0);
  });
}

function printAgentList(): void {
  logger.log(bold("Supported coding agents:"));
  logger.blank();
  const width = Math.max(...AGENTS.map((a) => a.id.length)) + 2;
  for (const agent of AGENTS) {
    const installed = isAgentInstalled(agent);
    const status = installed ? "" : dim(" (not installed)");
    logger.log(
      `  ${highlight(agent.id.padEnd(width))}${agent.label}${status}`,
    );
    logger.log(`  ${" ".repeat(width)}${dim(agent.description)}`);
  }
  logger.blank();
  logger.log(dim(`Launch one with ${highlight("llmgateway launch <agent>")} or ${highlight("llmgateway <agent>")}`));
  logger.log(dim(`Guides: https://llmgateway.io/guides`));
}

async function pickAgent(): Promise<AgentDefinition> {
  const choices = AGENTS.map((agent) => {
    const installed = isAgentInstalled(agent);
    return {
      title: installed ? agent.label : `${agent.label} ${dim("(not installed)")}`,
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
  return findAgent(answer.agent)!;
}

async function resolveApiKey(options: LaunchOptions): Promise<string> {
  if (options.key) {
    return options.key;
  }

  const envKey = getEnvApiKey();
  if (envKey) {
    return envKey;
  }

  const config = await getConfig();
  if (config.apiKey) {
    return config.apiKey;
  }

  if (!process.stdin.isTTY) {
    logger.error(
      "No LLM Gateway API key found. Set LLMGATEWAY_API_KEY, pass --key, or run `llmgateway auth login --key`.",
    );
    process.exit(1);
  }

  logger.blank();
  logger.log(bold("No LLM Gateway API key configured yet."));
  logger.log("Opening the dashboard so you can create one...");
  logger.blank();

  await open("https://llmgateway.io/dashboard/api-keys").catch(() => {
    logger.log(dim("Get a key at https://llmgateway.io/dashboard/api-keys"));
  });

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
  logger.success("API key saved to ~/.llmgateway/config.json");
  logger.blank();

  return response.apiKey;
}
