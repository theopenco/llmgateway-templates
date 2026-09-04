import fs from "fs-extra";
import { apiRequest, resolveOrgId } from "../utils/api.js";
import {
  installSkill,
  listOrgSkills,
  getOrgSkill,
  skillTarget,
  type OrganizationSkill,
  type SkillSummary,
} from "../utils/skills.js";
import { logger } from "../utils/logger.js";

interface SkillOptions {
  org?: string;
  json?: boolean;
  agent?: string;
  global?: boolean;
  all?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

function selectSkill(skills: SkillSummary[], name: string): SkillSummary {
  const matches = skills.filter(
    (skill) => skill.id === name || skill.name === name,
  );
  if (matches.length !== 1)
    throw new Error(
      `Skill "${name}" was not found or is ambiguous. Use its ID.`,
    );
  return matches[0];
}

export async function skillsList(options: SkillOptions): Promise<void> {
  const org = await resolveOrgId(options.org);
  const skills = await listOrgSkills(org);
  if (options.json) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }
  if (!skills.length)
    logger.log("No skills have been published to this organization.");
  for (const skill of skills)
    logger.log(
      `${skill.name} (${skill.id})${skill.enabled ? "" : " [disabled]"}\n  ${skill.description}`,
    );
}

export async function skillsShow(
  name: string,
  options: SkillOptions,
): Promise<void> {
  const org = await resolveOrgId(options.org);
  const summary = selectSkill(await listOrgSkills(org), name);
  const skill = await getOrgSkill(org, summary.id);
  console.log(options.json ? JSON.stringify(skill, null, 2) : skill.content);
}

export async function skillsAdd(
  names: string[],
  options: SkillOptions,
): Promise<void> {
  if (!names.length && !options.all)
    throw new Error(
      "Name one or more skills, or use --all to install enabled organization skills.",
    );
  if (names.length && options.all)
    throw new Error("Choose named skills or --all, not both.");
  const target = skillTarget(options.agent, options.global);
  const org = await resolveOrgId(options.org);
  const skills = await listOrgSkills(org);
  const selected = options.all
    ? skills.filter((skill) => skill.enabled)
    : [...new Set(names)].map((name) => selectSkill(skills, name));
  if (new Set(selected.map((skill) => skill.name)).size !== selected.length)
    throw new Error(
      "The catalog contains conflicting skill names. Install one by ID.",
    );
  const details = await Promise.all(
    selected.map((skill) => getOrgSkill(org, skill.id)),
  );
  // Preflight the complete batch before writing any files.
  for (const skill of details)
    await installSkill(skill, target, { ...options, dryRun: true });
  for (const skill of details) {
    const file = await installSkill(skill, target, options);
    logger.success(
      `${options.dryRun ? "Would install" : "Installed"} ${skill.name}: ${file}`,
    );
  }
  if (!selected.length)
    logger.log("No enabled skills are available in this organization.");
}

export async function skillsPublish(
  file: string,
  options: { org?: string },
): Promise<void> {
  const org = await resolveOrgId(options.org);
  const content = await fs.readFile(file, "utf8");
  if (Buffer.byteLength(content, "utf8") > 200_000)
    throw new Error("SKILL.md must be smaller than 200 KB.");
  const result = await apiRequest<{ skill: OrganizationSkill }>(
    `/orgs/${encodeURIComponent(org)}/skills`,
    {
      method: "POST",
      body: { content, files: [] },
    },
  );
  logger.success(
    `Published ${result.skill.name} (${result.skill.id}) to ${org}.`,
  );
}
