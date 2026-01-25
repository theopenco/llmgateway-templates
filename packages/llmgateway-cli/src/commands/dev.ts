import { spawn } from "child_process";
import fs from "fs-extra";
import path from "path";
import { logger, highlight, dim } from "../utils/logger.js";
import { detectPackageManager, getRunCommand } from "../utils/package-manager.js";

interface DevOptions {
  port?: string;
}

export async function dev(options: DevOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a project directory
  const packageJsonPath = path.join(cwd, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    logger.error("No package.json found in current directory.");
    logger.log(dim(`Run ${highlight("npx @llmgateway/cli init")} to create a new project first.`));
    process.exit(1);
  }

  const packageJson = await fs.readJson(packageJsonPath);

  // Check if dev script exists
  if (!packageJson.scripts?.dev) {
    logger.error("No 'dev' script found in package.json.");
    process.exit(1);
  }

  const pm = detectPackageManager(cwd);
  const devCommand = getRunCommand(pm, "dev");

  logger.blank();
  logger.log(`Starting development server...`);
  logger.log(dim(`Running: ${devCommand}`));
  logger.blank();

  // Build environment with optional PORT
  const env = { ...process.env };
  if (options.port) {
    env.PORT = options.port;
  }

  // Spawn the dev process
  const [cmd, ...args] = devCommand.split(" ");
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    env,
    shell: true,
  });

  child.on("error", (error) => {
    logger.error(`Failed to start: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
