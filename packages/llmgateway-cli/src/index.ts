#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { init } from "./commands/init.js";
import { list } from "./commands/list.js";
import { listModels } from "./commands/models.js";
import {
  authLogin,
  authStatus,
  authLogout,
  authWhoami,
} from "./commands/auth.js";
import {
  keysCreate,
  keysList,
  keysUpdate,
  keysSetBudget,
  keysGetBudget,
  keysRoll,
  keysDelete,
} from "./commands/keys.js";
import { usage, usageSources } from "./commands/usage.js";
import {
  orgsList,
  projectsList,
  projectsUse,
  credits,
} from "./commands/orgs.js";
import { withApiErrors } from "./utils/api.js";
import { configure } from "./commands/configure.js";
import { launch } from "./commands/launch.js";
import { AGENTS } from "./utils/agents.js";
import { dev } from "./commands/dev.js";
import { upgrade } from "./commands/upgrade.js";
import { docs } from "./commands/docs.js";
import { add } from "./commands/add.js";
import {
  agentsList,
  agentsAdd,
  agentsShow,
  agentsRemove,
} from "./commands/agents.js";
import { logger } from "./utils/logger.js";
import { orgsUse } from "./commands/orgs.js";
import {
  skillsList,
  skillsShow,
  skillsAdd,
  skillsPublish,
} from "./commands/skills.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program
  .name("llmgateway")
  .alias("lg")
  .description(
    "CLI tool for scaffolding LLM Gateway templates and managing AI projects",
  )
  .version(pkg.version)
  .enablePositionalOptions();

// launch command — start coding agents with LLM Gateway configured
const launchOptions = (cmd: Command): Command =>
  cmd
    .option("-m, --model <model>", "Model to use (any model on the gateway)")
    .option("-k, --key <key>", "LLM Gateway API key (overrides stored key)")
    .option(
      "--gateway-url <url>",
      "Gateway base URL (default: https://api.llmgateway.io)",
    )
    .option("--dry-run", "Show what would run without launching")
    .option(
      "--check-key",
      "Verify credentials with a one-token inference request (may incur a charge)",
    )
    .passThroughOptions()
    .allowUnknownOption();

launchOptions(
  program
    .command("launch [agent] [args...]")
    .description(
      "Launch a coding agent (claude, opencode, empryo, soulforge, codex, ...) with LLM Gateway configured",
    )
    .option("--list", "List supported agents")
    .addHelpText(
      "after",
      `
Launcher flags go before the agent name; everything after it is passed to the agent:

  $ llmgateway launch                          interactive agent picker
  $ llmgateway launch claude                   launch Claude Code on LLM Gateway
  $ llmgateway launch -m gpt-5.6-sol claude    ...using GPT-5.6 Sol
  $ llmgateway launch claude --continue        ...passing --continue to claude
  $ llmgateway opencode                        shortcut, same as launch opencode

Agents: ${AGENTS.map((a) => a.id).join(", ")}`,
    ),
).action((agent, args, opts) => launch(agent, args, opts));

const agentsCommand = program
  .command("agents")
  .description("List coding agents and register custom launchers");
agentsCommand
  .command("list")
  .alias("ls")
  .option("--json", "Output as JSON")
  .action(agentsList);
agentsCommand
  .command("add <file>")
  .description("Register a trusted JSON agent definition")
  .option("--force", "Replace an existing custom agent")
  .action(agentsAdd);
agentsCommand
  .command("show <id>")
  .description("Export a custom agent as JSON")
  .action(agentsShow);
agentsCommand
  .command("remove <id>")
  .description("Remove a registered custom agent")
  .action(agentsRemove);

const skillsCommand = program
  .command("skills")
  .description("Browse and install your organization's shared skills");
skillsCommand
  .command("list")
  .alias("ls")
  .option("--org <id>", "Organization ID")
  .option("--json", "Output as JSON")
  .action(skillsList);
skillsCommand
  .command("show <skill>")
  .option("--org <id>", "Organization ID")
  .option("--json", "Output as JSON")
  .action(skillsShow);
skillsCommand
  .command("add [skills...]")
  .alias("install")
  .option("--org <id>", "Organization ID")
  .option("--all", "Install all enabled skills")
  .option(
    "--agent <agent>",
    "Skill target: agents, codex, claude, opencode, cursor, qwen, pi",
    "agents",
  )
  .option("--global", "Install in your home directory instead of this project")
  .option("--force", "Replace existing skill files")
  .option("--dry-run", "Preview without creating files")
  .action(skillsAdd);
skillsCommand
  .command("publish <file>")
  .description("Publish a SKILL.md file (organization admins and owners)")
  .option("--org <id>", "Organization ID")
  .action(skillsPublish);

// hidden per-agent shortcuts: `llmgateway claude`, `llmgateway opencode`, ...
for (const agent of AGENTS) {
  for (const name of [agent.id, ...(agent.aliases ?? [])]) {
    launchOptions(
      program
        .command(`${name} [args...]`, { hidden: true })
        .description(`Launch ${agent.label} with LLM Gateway configured`),
    ).action((args, opts) => launch(agent.id, args, opts));
  }
}

// configure command — generate agent config files with the gateway's models
program
  .command("configure [agent]")
  .description(
    "Generate an agent config with LLM Gateway's coding models (opencode, claude)",
  )
  .option(
    "-k, --key <key>",
    "LLM Gateway API key (claude; overrides stored key)",
  )
  .option(
    "--gateway-url <url>",
    "Gateway base URL (default: https://api.llmgateway.io)",
  )
  .option(
    "--project",
    "Write to ./.claude/settings.local.json instead of ~/.claude/settings.json (claude)",
  )
  .option("--dry-run", "Show what would be written without writing")
  .addHelpText(
    "after",
    `
Examples:

  $ llmgateway configure opencode    add every coding model, pinned per provider, to opencode's picker
  $ llmgateway configure claude      route Claude Code through LLM Gateway; /model lists gateway models
  $ llmgateway configure claude --project   ...for the current repo only

\`llmgateway launch opencode\` and \`llmgateway launch claude\` apply the same setup automatically.`,
  )
  .action(configure);

// init command
program
  .command("init [directory]")
  .description("Create a new project from a template")
  .option(
    "-t, --template <name>",
    "Template to use (default: image-generation)",
  )
  .option("-n, --name <name>", "Project name")
  .option("--no-install", "Create files without installing dependencies")
  .option("--ref <ref>", "Template Git branch, tag, or commit", "main")
  .action(init);

// list command
program
  .command("list")
  .alias("ls")
  .description("List available templates")
  .option("--json", "Output as JSON")
  .action(list);

// models command
program
  .command("models")
  .description("Browse and search available models")
  .option("-c, --capability <type>", "Filter by capability (e.g., image, text)")
  .option(
    "-p, --provider <name>",
    "Filter by provider (e.g., openai, anthropic)",
  )
  .option("-s, --search <term>", "Search models by name")
  .option("--json", "Output as JSON")
  .action(listModels);

// auth command
const authCommand = program
  .command("auth")
  .description("Manage authentication (dashboard session and API key)");

authCommand
  .command("login")
  .description("Sign in in your browser (including SSO), or store an API key")
  .option(
    "--sso [email]",
    "Open enterprise SSO, optionally prefilling your work email",
  )
  .option(
    "--no-browser",
    "Print the verification URL without opening a browser",
  )
  .option("--api-url <url>", "Management API URL for a self-hosted deployment")
  .option("--dashboard-url <url>", "Dashboard URL for browser approval")
  .option("--gateway-url <url>", "Save the inference gateway URL")
  .option("--org <id>", "Select an organization after signing in")
  .option(
    "--timeout <seconds>",
    "Browser approval timeout (1–1800 seconds)",
    "600",
  )
  .option("--email [email]", "Sign in with email & password")
  .option("--key", "Store a gateway API key instead of signing in")
  .action(withApiErrors(authLogin));

authCommand
  .command("status")
  .description("Check authentication status")
  .action(authStatus);

authCommand
  .command("whoami")
  .description("Show the signed-in user")
  .action(authWhoami);

authCommand
  .command("logout")
  .description("Remove stored session and API key")
  .action(authLogout);

// keys command
const keysCommand = program
  .command("keys")
  .description("Manage LLM Gateway API keys");

keysCommand
  .command("create")
  .description("Create a new API key")
  .option("-p, --project <id>", "Project the key belongs to")
  .option("-d, --description <text>", "Key description")
  .option(
    "-l, --limit <usd>",
    "Total spending limit in USD (e.g. 100 or 49.99)",
  )
  .option("--period-limit <usd>", "Spending limit per rolling period in USD")
  .option(
    "--period <duration>",
    "Rolling period for --period-limit (12h, 1d, 2w, 1mo; default 1mo)",
  )
  .option("-e, --expires <ttl>", "TTL as a duration (30d, 12h) or an ISO date")
  .option("--json", "Output as JSON")
  .action(withApiErrors(keysCreate));

keysCommand
  .command("list")
  .alias("ls")
  .description("List API keys")
  .option("-p, --project <id>", "Filter by project")
  .option("--all", "Show all keys in the org (admin/owner only)")
  .option("--json", "Output as JSON")
  .action(withApiErrors(keysList));

keysCommand
  .command("update <id>")
  .description("Activate or deactivate an API key")
  .option("--activate", "Set the key to active")
  .option("--deactivate", "Set the key to inactive")
  .option(
    "-e, --expires <ttl>",
    "New expiry as a duration (30d) or ISO date (needed to reactivate expired keys)",
  )
  .action(withApiErrors(keysUpdate));

keysCommand
  .command("limit <id>")
  .description("Set spending limits on an API key (same as `budget set`)")
  .option("-l, --limit <usd>", "Total spending limit in USD")
  .option("--period-limit <usd>", "Spending limit per rolling period in USD")
  .option(
    "--period <duration>",
    "Rolling period for --period-limit (12h, 1d, 2w, 1mo; default 1mo)",
  )
  .option("--clear", "Remove all spending limits")
  .action(withApiErrors(keysSetBudget));

keysCommand
  .command("roll <id>")
  .description("Regenerate the token for an API key")
  .option("-y, --yes", "Skip confirmation")
  .action(withApiErrors(keysRoll));

keysCommand
  .command("delete <id>")
  .alias("rm")
  .description("Delete an API key")
  .option("-y, --yes", "Skip confirmation")
  .action(withApiErrors(keysDelete));

// budget command
const budgetCommand = program
  .command("budget")
  .description("Manage API key spending limits");

budgetCommand
  .command("set <keyId>")
  .description("Set a budget (spending limit) on an API key")
  .option("-l, --limit <usd>", "Total spending limit in USD")
  .option("--period-limit <usd>", "Spending limit per rolling period in USD")
  .option(
    "--period <duration>",
    "Rolling period for --period-limit (12h, 1d, 2w, 1mo; default 1mo)",
  )
  .option("--clear", "Remove all spending limits")
  .action(withApiErrors(keysSetBudget));

budgetCommand
  .command("get <keyId>")
  .description("Show budget and current spend for an API key")
  .option("-p, --project <id>", "Project the key belongs to")
  .option("--json", "Output as JSON")
  .action(withApiErrors(keysGetBudget));

// usage command
const usageCommand = program
  .command("usage")
  .description("View usage and cost analytics")
  .option("-o, --org <id>", "Aggregate usage across an organization")
  .option("-p, --project <id>", "Filter by project")
  .option("-k, --api-key <id>", "Filter by API key")
  .option("--by <dimension>", "Break down by: model, key")
  .option("-r, --range <range>", "Time range: 1h, 4h, 24h, 7d, 30d, 365d", "7d")
  .option("--days <n>", "Look back N days instead of --range")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .option("--json", "Output as JSON")
  .action(withApiErrors(usage));

usageCommand
  .command("sources")
  .description("Usage broken down by session/agent source")
  .option("-p, --project <id>", "Project to inspect")
  .option("-r, --range <range>", "Time range: 7d, 30d", "7d")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .option("--json", "Output as JSON")
  .action(withApiErrors(usageSources));

// orgs command
const orgsCommand = program.command("orgs").description("Manage organizations");
orgsCommand
  .command("use <id>")
  .description("Select the default organization")
  .action(orgsUse);

orgsCommand
  .command("list")
  .alias("ls")
  .description("List your organizations")
  .option("--json", "Output as JSON")
  .action(withApiErrors(orgsList));

// projects command
const projectsCommand = program
  .command("projects")
  .description("Manage projects");

projectsCommand
  .command("list")
  .alias("ls")
  .description("List projects")
  .option("-o, --org <id>", "Filter by organization")
  .option("--json", "Output as JSON")
  .action(withApiErrors(projectsList));

projectsCommand
  .command("use <id>")
  .description("Set the default project for keys/usage commands")
  .action(withApiErrors(projectsUse));

// credits command
program
  .command("credits")
  .description("Show organization credit balances")
  .option("-o, --org <id>", "Organization to show")
  .option("--json", "Output as JSON")
  .action(withApiErrors(credits));

// dev command
program
  .command("dev")
  .description("Start the development server")
  .option("-p, --port <port>", "Port to run on")
  .action(dev);

// upgrade command
program
  .command("upgrade")
  .description("Upgrade @llmgateway packages to latest versions")
  .option("--check", "Check for updates without installing")
  .action(upgrade);

// docs command
program
  .command("docs [topic]")
  .description("Open documentation in browser")
  .action(docs);

// add command
program
  .command("add [type] [name]")
  .description("Add tools, components, or routes to your project")
  .action(add);

program.parseAsync().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : "Command failed.");
  process.exitCode = 1;
});
