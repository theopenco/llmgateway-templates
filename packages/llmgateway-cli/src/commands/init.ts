import path from "path";
import fs from "fs-extra";
import degit from "degit";
import prompts from "prompts";
import ora from "ora";
import { exec } from "child_process";
import { promisify } from "util";
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
}

export async function init(
  directory: string | undefined,
  options: InitOptions
): Promise<void> {
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
  const spinner = ora(`Cloning ${highlight(template.name)} template...`).start();

  try {
    const emitter = degit(`${REPO}/${template.path}`, {
      cache: false,
      force: true,
    });

    await emitter.clone(fullPath);
    spinner.succeed(`Cloned ${highlight(template.name)} template`);
  } catch (error) {
    spinner.fail("Failed to clone template");
    logger.error(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
    process.exit(1);
  }

  // Update package.json with project name
  const packageJsonPath = path.join(fullPath, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      packageJson.name = projectName || path.basename(fullPath);
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    } catch {
      // Ignore errors updating package.json
    }
  }

  // Copy .env.example to .env.local if it exists
  const envExamplePath = path.join(fullPath, ".env.example");
  const envLocalPath = path.join(fullPath, ".env.local");
  if ((await fs.pathExists(envExamplePath)) && !(await fs.pathExists(envLocalPath))) {
    await fs.copy(envExamplePath, envLocalPath);
    logger.success("Created .env.local from .env.example");
  }

  // Detect package manager and install dependencies
  const pm = detectPackageManager(process.cwd());
  const installSpinner = ora(`Installing dependencies with ${pm}...`).start();

  try {
    await execAsync(getInstallCommand(pm), { cwd: fullPath });
    installSpinner.succeed("Dependencies installed");
  } catch {
    installSpinner.warn(
      "Failed to install dependencies. Run install manually."
    );
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

  logger.log(`  ${dim("$")} ${highlight("# Add your LLM Gateway API key to .env.local")}`);
  logger.log(`  ${dim("$")} ${highlight(getRunCommand(pm, "dev"))}`);
  logger.blank();
  logger.log(
    `Get your API key at ${highlight("https://llmgateway.io")}`
  );
  logger.blank();
}
