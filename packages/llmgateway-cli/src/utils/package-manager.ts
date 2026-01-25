import fs from "fs";
import path from "path";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

export function getInstallCommand(pm: PackageManager): string {
  return pm === "npm" ? "npm install" : `${pm} install`;
}

export function getRunCommand(pm: PackageManager, script: string): string {
  if (pm === "npm") return `npm run ${script}`;
  return `${pm} ${script}`;
}
