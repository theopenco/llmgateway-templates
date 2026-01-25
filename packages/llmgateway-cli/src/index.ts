#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "module";
import { init } from "./commands/init.js";
import { list } from "./commands/list.js";
import { listModels } from "./commands/models.js";
import { authLogin, authStatus, authLogout } from "./commands/auth.js";
import { dev } from "./commands/dev.js";
import { upgrade } from "./commands/upgrade.js";
import { docs } from "./commands/docs.js";
import { add } from "./commands/add.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const program = new Command();

program
  .name("llmgateway")
  .alias("lg")
  .description("CLI tool for scaffolding LLM Gateway templates and managing AI projects")
  .version(pkg.version);

// init command
program
  .command("init [directory]")
  .description("Create a new project from a template")
  .option("-t, --template <name>", "Template to use (default: image-generation)")
  .option("-n, --name <name>", "Project name")
  .action(init);

// list command
program
  .command("list")
  .description("List available templates")
  .option("--json", "Output as JSON")
  .action(list);

// models command
program
  .command("models")
  .description("Browse and search available models")
  .option("-c, --capability <type>", "Filter by capability (e.g., image, text)")
  .option("-p, --provider <name>", "Filter by provider (e.g., openai, anthropic)")
  .option("-s, --search <term>", "Search models by name")
  .option("--json", "Output as JSON")
  .action(listModels);

// auth command
const authCommand = program
  .command("auth")
  .description("Manage API key authentication");

authCommand
  .command("login")
  .description("Authenticate with LLM Gateway")
  .action(authLogin);

authCommand
  .command("status")
  .description("Check authentication status")
  .action(authStatus);

authCommand
  .command("logout")
  .description("Remove stored API key")
  .action(authLogout);

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

program.parse();
