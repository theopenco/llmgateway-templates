import path from "path";
import fs from "fs-extra";
import degit from "degit";
import prompts from "prompts";
import ora from "ora";
import { exec } from "child_process";
import { promisify } from "util";
import { standaloneManifest } from "../utils/scaffold.js";
import { logger, highlight, bold, dim } from "../utils/logger.js";
import {
  templates,
  getTemplate,
  DEFAULT_TEMPLATE,
  REPO,
} from "../utils/templates.js";
import {
  detectPackageManager,
  getInstallCommand,
  getRunCommand,
} from "../utils/package-manager.js";

const execAsync = promisify(exec);

interface InitOptions {
  template?: string;
  name?: string;
  install?: boolean;
  ref?: string;
}

export async function init(
  directory: string | undefined,
  options: InitOptions,
): Promise<void> {
  const ref = options.ref ?? "main";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(ref) || ref.includes(".."))
    throw new Error("Invalid Git ref.");
  if (
    !process.stdin.isTTY &&
    (!options.template || (!directory && !options.name))
  ) {
    throw new Error(
      "Non-interactive scaffolding requires --template and a directory or --name.",
    );
  }
  let templateName = options.template;
  let projectName = options.name;
  let targetDir = directory;

  // Interactive mode if template not specified
  if (!templateName) {
    const response = await prompts([
      {
        type: "select",
        name: "template",
        message: "Which template would you like to use?",
        choices: templates.map((t) => ({
          title: `${t.name} ${dim(`- ${t.description}`)}`,
          value: t.name,
        })),
        initial: templates.findIndex((t) => t.name === DEFAULT_TEMPLATE),
      },
    ]);

    if (!response.template) {
      logger.error("Template selection cancelled.");
      process.exit(1);
    }

    templateName = response.template as string;
  }

  const template = getTemplate(templateName);
  if (!template) {
    logger.error(`Template "${templateName}" not found.`);
    logger.log("");
    logger.log("Available templates:");
    templates.forEach((t) => {
      logger.log(`  ${highlight(t.name)} - ${t.description}`);
    });
    process.exit(1);
  }

  // Get project name if not specified
  if (!projectName && !targetDir) {
    const response = await prompts({
      type: "text",
      name: "name",
      message: "What is your project name?",
      initial: template.name,
    });

    if (!response.name) {
      logger.error("Project name is required.");
      process.exit(1);
    }

    projectName = response.name;
  }

  // Determine target directory
  targetDir = targetDir || projectName || template.name;
  const fullPath = path.resolve(process.cwd(), targetDir);

  // Check if directory exists
  if (await fs.pathExists(fullPath)) {
    const files = await fs.readdir(fullPath);
    if (files.length > 0) {
      if (!process.stdin.isTTY)
        throw new Error(
          `Directory ${targetDir} is not empty. Choose an empty directory.`,
        );
      const response = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `Directory ${highlight(targetDir)} is not empty. Continue anyway?`,
        initial: false,
      });

      if (!response.overwrite) {
        logger.error("Aborted.");
        process.exit(1);
      }
    }
  }

  // Clone template
  const spinner = ora(
    `Cloning ${highlight(template.name)} template...`,
  ).start();

  try {
    const emitter = degit(`${REPO}/${template.path}#${ref}`, {
      cache: false,
      force: true,
    });

    await emitter.clone(fullPath);
    spinner.succeed(`Cloned ${highlight(template.name)} template`);
  } catch (error) {
    spinner.fail("Failed to clone template");
    logger.error(
      error instanceof Error ? error.message : "Unknown error occurred",
    );
    process.exit(1);
  }

  // Update package.json with project name
  const packageJsonPath = path.join(fullPath, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = standaloneManifest(
      await fs.readJson(packageJsonPath),
      template,
      projectName || path.basename(fullPath),
    );
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  // Copy .env.example to .env.local if it exists
  const envExamplePath = path.join(fullPath, ".env.example");
  const envLocalPath = path.join(fullPath, ".env.local");
  if (
    (await fs.pathExists(envExamplePath)) &&
    !(await fs.pathExists(envLocalPath))
  ) {
    await fs.copy(envExamplePath, envLocalPath);
    await fs.chmod(envLocalPath, 0o600);
    logger.success("Created .env.local from .env.example");
  }

  // Detect package manager and install dependencies
  const pm = detectPackageManager(process.cwd());
  if (options.install !== false) {
    const installSpinner = ora(`Installing dependencies with ${pm}...`).start();
    try {
      await execAsync(getInstallCommand(pm), { cwd: fullPath });
      installSpinner.succeed("Dependencies installed");
    } catch {
      installSpinner.warn(
        "Failed to install dependencies. Run install manually.",
      );
      process.exitCode = 1;
    }
  }

  // Print success message
  logger.blank();
  logger.success(bold("Project created successfully!"));
  logger.blank();
  logger.log("Next steps:");
  logger.blank();

  const cdCommand = targetDir !== "." ? `cd ${targetDir}` : null;

  if (cdCommand) {
    logger.log(`  ${dim("$")} ${highlight(cdCommand)}`);
  }
  if (options.install === false)
    logger.log(`  ${dim("$")} ${highlight(getInstallCommand(pm))}`);

  logger.log(
    `  ${dim("$")} ${highlight("# Add your LLM Gateway API key to .env.local")}`,
  );
  logger.log(`  ${dim("$")} ${highlight(getRunCommand(pm, "dev"))}`);
  logger.blank();
  logger.log(`Get your API key at ${highlight("https://llmgateway.io")}`);
  logger.blank();
}
