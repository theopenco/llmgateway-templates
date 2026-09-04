import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import fs from "fs-extra";
import { apiRequest } from "./api.js";

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}
export interface OrganizationSkill extends SkillSummary {
  content: string;
  files: { path: string; content: string; encoding?: "utf-8" | "base64" }[];
}

export const SKILL_TARGETS: Record<
  string,
  { project: string; global: string }
> = {
  agents: { project: ".agents/skills", global: ".agents/skills" },
  codex: { project: ".agents/skills", global: ".agents/skills" },
  claude: { project: ".claude/skills", global: ".claude/skills" },
  opencode: { project: ".opencode/skills", global: ".config/opencode/skills" },
  cursor: { project: ".cursor/skills", global: ".cursor/skills" },
  qwen: { project: ".qwen/skills", global: ".qwen/skills" },
  pi: { project: ".pi/skills", global: ".pi/agent/skills" },
};

function validateSummary(skill: SkillSummary): void {
  if (
    !skill ||
    typeof skill.id !== "string" ||
    typeof skill.name !== "string" ||
    typeof skill.description !== "string" ||
    typeof skill.enabled !== "boolean"
  )
    throw new Error("Invalid organization skill.");
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) ||
    skill.name.length > 64 ||
    reservedName(skill.name)
  ) {
    throw new Error(
      `Skill "${skill.name}" needs a portable lowercase name of up to 64 characters (letters, numbers, hyphens).`,
    );
  }
}

export async function listOrgSkills(org: string): Promise<SkillSummary[]> {
  const data = await apiRequest<{ skills: SkillSummary[] }>(
    `/orgs/${encodeURIComponent(org)}/skills`,
  );
  if (!Array.isArray(data.skills))
    throw new Error("Invalid organization skills response.");
  data.skills.forEach(validateSummary);
  return data.skills;
}

export async function getOrgSkill(
  org: string,
  id: string,
): Promise<OrganizationSkill> {
  const { skill } = await apiRequest<{ skill: OrganizationSkill }>(
    `/orgs/${encodeURIComponent(org)}/skills/${encodeURIComponent(id)}`,
  );
  skillFiles(skill);
  return skill;
}

function reservedName(value: string): boolean {
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}

function validFilePath(value: string): boolean {
  return (
    /^[a-zA-Z0-9_][a-zA-Z0-9._/-]*$/.test(value) &&
    value.length <= 200 &&
    value
      .split("/")
      .every(
        (part) =>
          part &&
          part !== "." &&
          part !== ".." &&
          !part.endsWith(".") &&
          !reservedName(part),
      )
  );
}

/** Validate every filename and byte before touching the filesystem. */
export function skillFiles(
  skill: OrganizationSkill,
): { path: string; content: Buffer }[] {
  validateSummary(skill);
  if (
    typeof skill.content !== "string" ||
    !skill.content.trim() ||
    skill.content.includes("\0") ||
    !Array.isArray(skill.files) ||
    skill.files.length > 100
  )
    throw new Error("Invalid skill content or supporting files.");
  const files = [
    { path: "SKILL.md", content: Buffer.from(skill.content, "utf8") },
  ];
  for (const file of skill.files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      !validFilePath(file.path) ||
      file.path.toLowerCase() === "skill.md" ||
      typeof file.content !== "string" ||
      (file.encoding !== undefined &&
        file.encoding !== "utf-8" &&
        file.encoding !== "base64")
    )
      throw new Error("Invalid supporting file path or encoding.");
    if (file.encoding === "base64") {
      if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          file.content,
        )
      )
        throw new Error("Invalid base64 file content.");
    } else if (file.content.includes("\0"))
      throw new Error("Text skill files cannot contain null bytes.");
    files.push({
      path: file.path,
      content: Buffer.from(
        file.content,
        file.encoding === "base64" ? "base64" : "utf8",
      ),
    });
  }
  const paths = files.map((file) => file.path.toLowerCase());
  if (
    new Set(paths).size !== paths.length ||
    paths.some((a) => paths.some((b) => b.startsWith(`${a}/`)))
  )
    throw new Error("Duplicate or overlapping skill file paths.");
  if (
    files.reduce((total, file) => total + file.content.length, 0) >
    1024 * 1024
  )
    throw new Error("A skill must not exceed 1 MiB.");
  return files;
}

export function skillTarget(
  agent = "agents",
  global = false,
  cwd = process.cwd(),
): { base: string; directory: string } {
  const target = Object.hasOwn(SKILL_TARGETS, agent)
    ? SKILL_TARGETS[agent]
    : undefined;
  if (!target)
    throw new Error(
      `Unsupported skill target ${agent}. Choose: ${Object.keys(SKILL_TARGETS).join(", ")}.`,
    );
  return {
    base: global ? os.homedir() : cwd,
    directory: global ? target.global : target.project,
  };
}

async function lstat(file: string) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Reject symlinked parents and stage a complete skill before replacing an existing one. */
export async function installSkill(
  skill: OrganizationSkill,
  target: { base: string; directory: string },
  options: { force?: boolean; dryRun?: boolean } = {},
): Promise<string> {
  const files = skillFiles(skill);
  if (!skill.enabled) throw new Error(`Skill ${skill.name} is disabled.`);
  const base = await fs.realpath(target.base);
  if (
    path.isAbsolute(target.directory) ||
    target.directory.split(path.sep).includes("..")
  )
    throw new Error("Invalid skill target directory.");
  let directory = base;
  for (const segment of target.directory.split(path.sep)) {
    directory = path.join(directory, segment);
    const stat = await lstat(directory);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
      throw new Error(
        `Refusing to install through ${directory}: expected a directory, not a symlink.`,
      );
    if (!stat && !options.dryRun) await fs.mkdir(directory);
  }
  const destination = path.join(directory, skill.name);
  const stat = await lstat(destination);
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    throw new Error(
      `Refusing to overwrite ${destination}: expected a directory, not a symlink.`,
    );
  if (stat && !options.force)
    throw new Error(
      `${destination} already exists. Use --force to replace the skill directory.`,
    );
  if (stat) {
    for (const file of files) {
      let entry = destination;
      for (const segment of file.path.split("/")) {
        entry = path.join(entry, segment);
        if ((await lstat(entry))?.isSymbolicLink())
          throw new Error(
            `Refusing to overwrite ${entry}: expected a regular file or directory, not a symlink.`,
          );
      }
    }
  }
  if (options.dryRun) return path.join(destination, "SKILL.md");
  const stage = path.join(directory, `.install-${randomUUID()}`);
  const backup = path.join(directory, `.backup-${randomUUID()}`);
  await fs.mkdir(stage, { mode: 0o700 });
  try {
    for (const file of files) {
      const fullPath = path.join(stage, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true, mode: 0o700 });
      await fs.writeFile(fullPath, file.content, { flag: "wx", mode: 0o600 });
    }
    if (stat) await fs.rename(destination, backup);
    try {
      await fs.rename(stage, destination);
    } catch (error) {
      if (stat) await fs.rename(backup, destination);
      throw error;
    }
    if (stat) await fs.remove(backup);
  } finally {
    await fs.remove(stage);
  }
  return path.join(destination, "SKILL.md");
}
