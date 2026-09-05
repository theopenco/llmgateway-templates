import prompts from "prompts";
import {
  buildOpencodeModelEntries,
  claudeSettingsFile,
  countClaudeVisibleModels,
  opencodeGlobalConfigFile,
  syncOpencodeModelCatalog,
  writeClaudeGatewaySettings,
} from "../utils/agent-configs.js";
import { getConfig, getEnvApiKey, getGatewayUrl } from "../utils/config.js";
import { logger, highlight, dim, bold } from "../utils/logger.js";

export interface ConfigureOptions {
  key?: string;
  gatewayUrl?: string;
  project?: boolean;
  dryRun?: boolean;
}

const CONFIGURABLE = [
  {
    id: "opencode",
    label: "OpenCode",
    description:
      "Add every gateway coding model, pinned per provider, to the opencode model picker",
  },
  {
    id: "claude",
    label: "Claude Code",
    description:
      "Route Claude Code through LLM Gateway and list gateway models in /model",
  },
] as const;

type ConfigurableId = (typeof CONFIGURABLE)[number]["id"];

function normalizeAgent(name: string): ConfigurableId | undefined {
  const normalized = name.toLowerCase();
  if (normalized === "opencode") {
    return "opencode";
  }
  if (normalized === "claude" || normalized === "claude-code") {
    return "claude";
  }
  return undefined;
}

export async function configure(
  agentName: string | undefined,
  options: ConfigureOptions = {},
): Promise<void> {
  let agent: ConfigurableId | undefined;
  if (agentName) {
    agent = normalizeAgent(agentName);
    if (!agent) {
      logger.error(
        `Cannot generate a config for "${agentName}". Supported: ${CONFIGURABLE.map((a) => a.id).join(", ")}.`,
      );
      logger.log(
        dim(
          `Other agents are configured at launch time — run ${highlight("llmgateway launch " + agentName)} instead.`,
        ),
      );
      process.exit(1);
    }
  } else {
    agent = await pickAgent();
  }

  if (agent === "opencode") {
    await configureOpencode(options);
  } else {
    await configureClaude(options);
  }
}

async function pickAgent(): Promise<ConfigurableId> {
  if (!process.stdin.isTTY)
    throw new Error("Specify an agent to configure: claude or opencode.");
  const answer = await prompts({
    type: "select",
    name: "agent",
    message: "Which agent do you want to generate a config for?",
    choices: CONFIGURABLE.map((agent) => ({
      title: agent.label,
      description: agent.description,
      value: agent.id,
    })),
  });
  if (!answer.agent) {
    process.exit(1);
  }
  return answer.agent;
}

async function configureOpencode(options: ConfigureOptions): Promise<void> {
  if (options.dryRun) {
    const entries = buildOpencodeModelEntries();
    const ids = Object.keys(entries);
    logger.blank();
    logger.log(bold(`Would write ${ids.length} provider-pinned models to:`));
    logger.log(`  ${highlight(opencodeGlobalConfigFile())}`);
    logger.blank();
    logger.log(dim("Sample entries:"));
    for (const id of ids.slice(0, 8)) {
      logger.log(`  llmgateway/${highlight(id)}  ${dim(entries[id].name)}`);
    }
    logger.log(dim(`  ... and ${ids.length - 8} more`));
    logger.blank();
    return;
  }

  const result = await syncOpencodeModelCatalog(
    await getGatewayUrl(options.gatewayUrl),
  );
  logger.success(
    `Synced ${result.total} provider-pinned gateway models into ${result.file}`,
  );
  logger.log(
    dim(
      `  ${result.added} added, ${result.updated} refreshed — existing custom entries were left untouched.`,
    ),
  );
  logger.blank();
  logger.log(
    `They appear in opencode's model picker as ${highlight("llmgateway/<provider>/<model>")} (e.g. ${highlight("llmgateway/anthropic/claude-sonnet-5")}),`,
  );
  logger.log(
    `pinned to that upstream provider. Verify with ${highlight("opencode models | grep llmgateway/")}, and restart opencode to pick up changes.`,
  );
  logger.blank();
  logger.log(
    dim(
      "Root model ids (auto-routed) are built into opencode already; launch with `llmgateway opencode` to also set up your API key.",
    ),
  );
}

async function configureClaude(options: ConfigureOptions): Promise<void> {
  const gatewayUrl = await getGatewayUrl(options.gatewayUrl);
  const scope = options.project ? "project" : "user";

  const apiKey = options.key ?? getEnvApiKey() ?? (await getConfig()).apiKey;
  if (!apiKey) {
    logger.error("No LLM Gateway API key found.");
    logger.log(
      dim(
        `Pass ${highlight("--key")}, set ${highlight("LLMGATEWAY_API_KEY")}, or run ${highlight("llmgateway auth login --key")} first.`,
      ),
    );
    process.exit(1);
  }

  const { visible, total } = countClaudeVisibleModels();

  if (options.dryRun) {
    logger.blank();
    logger.log(bold("Would update:"));
    logger.log(`  ${highlight(claudeSettingsFile(scope))}`);
    logger.log(dim("  env.ANTHROPIC_BASE_URL, env.ANTHROPIC_AUTH_TOKEN,"));
    logger.log(dim("  env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1"));
    logger.blank();
    return;
  }

  const { file } = await writeClaudeGatewaySettings({
    gatewayUrl,
    apiKey,
    scope,
  });
  logger.success(`Claude Code now routes through LLM Gateway (${file})`);
  logger.log(
    dim(
      "  Set env.ANTHROPIC_BASE_URL, env.ANTHROPIC_AUTH_TOKEN and enabled gateway model discovery; other settings were preserved.",
    ),
  );
  logger.blank();
  logger.log(
    `Restart Claude Code and run ${highlight("/model")} — the gateway's catalog is listed under ${highlight("From gateway")}.`,
  );
  logger.log(
    dim(
      `  Claude Code shows gateway models whose id starts with "claude" or "anthropic" (${visible} of ${total} coding models today).`,
    ),
  );
  logger.log(
    dim(
      "  Any other gateway model still works via `claude --model <id>` or ANTHROPIC_MODEL.",
    ),
  );
  logger.blank();
  logger.log(
    dim(
      `To undo, remove those env keys from ${file}. Requires Claude Code v2.1.129+.`,
    ),
  );
}
