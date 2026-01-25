import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import { logger, highlight, dim, bold } from "../utils/logger.js";
import { detectPackageManager } from "../utils/package-manager.js";

const execAsync = promisify(exec);

interface UpgradeOptions {
  check?: boolean;
}

const LLMGATEWAY_PACKAGES = [
  "@llmgateway/ai-sdk-provider",
  "@llmgateway/models",
  "@llmgateway/cli",
];

export async function upgrade(options: UpgradeOptions): Promise<void> {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    logger.error("No package.json found in current directory.");
    process.exit(1);
  }

  const packageJson = await fs.readJson(packageJsonPath);
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Find installed LLM Gateway packages
  const installedPackages = LLMGATEWAY_PACKAGES.filter(
    (pkg) => pkg in allDeps
  );

  if (installedPackages.length === 0) {
    logger.warn("No @llmgateway packages found in this project.");
    process.exit(0);
  }

  logger.blank();
  logger.log(bold("LLM Gateway packages in this project:"));
  logger.blank();

  for (const pkg of installedPackages) {
    const version = allDeps[pkg];
    logger.log(`  ${highlight(pkg)} ${dim(version)}`);
  }

  logger.blank();

  if (options.check) {
    logger.log(dim("Run without --check to upgrade packages."));
    logger.blank();
    return;
  }

  const pm = detectPackageManager(cwd);
  const spinner = ora("Upgrading packages...").start();

  try {
    let upgradeCmd: string;

    switch (pm) {
      case "pnpm":
        upgradeCmd = `pnpm update ${installedPackages.join(" ")} --latest`;
        break;
      case "yarn":
        upgradeCmd = `yarn upgrade ${installedPackages.join(" ")} --latest`;
        break;
      case "bun":
        upgradeCmd = `bun update ${installedPackages.join(" ")}`;
        break;
      default:
        upgradeCmd = `npm update ${installedPackages.join(" ")}`;
    }

    await execAsync(upgradeCmd, { cwd });
    spinner.succeed("Packages upgraded successfully!");

    // Read updated versions
    const updatedPackageJson = await fs.readJson(packageJsonPath);
    const updatedDeps = {
      ...updatedPackageJson.dependencies,
      ...updatedPackageJson.devDependencies,
    };

    logger.blank();
    logger.log(bold("Updated versions:"));
    logger.blank();

    for (const pkg of installedPackages) {
      const oldVersion = allDeps[pkg];
      const newVersion = updatedDeps[pkg];
      if (oldVersion !== newVersion) {
        logger.log(`  ${highlight(pkg)} ${dim(oldVersion)} -> ${highlight(newVersion)}`);
      } else {
        logger.log(`  ${highlight(pkg)} ${dim(newVersion)} (no change)`);
      }
    }

    logger.blank();
  } catch (error) {
    spinner.fail("Failed to upgrade packages");
    logger.error(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}
