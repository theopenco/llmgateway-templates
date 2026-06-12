import { logger, highlight, dim, bold } from "../utils/logger.js";
import {
  listOrganizations,
  listProjects,
  type Organization,
} from "../utils/api.js";
import { getConfig, setConfig } from "../utils/config.js";
import { formatUSD, renderTable } from "../utils/format.js";

interface JsonOption {
  json?: boolean;
}

export async function orgsList(options: JsonOption): Promise<void> {
  const orgs = await listOrganizations();

  if (options.json) {
    console.log(JSON.stringify(orgs, null, 2));
    return;
  }

  const config = await getConfig();

  logger.blank();
  logger.log(bold(`Organizations (${orgs.length}):`));
  logger.blank();

  for (const line of renderTable(
    ["NAME", "ID", "PLAN", "CREDITS", ""],
    orgs.map((org) => [
      org.name,
      dim(org.id),
      org.plan,
      formatUSD(org.credits),
      org.id === config.defaultOrgId ? highlight("default") : "",
    ]),
  )) {
    logger.log(line);
  }
  logger.blank();
}

interface ProjectsListOptions extends JsonOption {
  org?: string;
}

export async function projectsList(
  options: ProjectsListOptions,
): Promise<void> {
  const config = await getConfig();
  const orgs = await listOrganizations();

  const targetOrgs = options.org
    ? orgs.filter((o) => o.id === options.org || o.name === options.org)
    : config.defaultOrgId
      ? orgs.filter((o) => o.id === config.defaultOrgId)
      : orgs;

  if (options.org && targetOrgs.length === 0) {
    logger.error(`Organization "${options.org}" not found.`);
    process.exit(1);
  }

  const all = await Promise.all(
    targetOrgs.map(async (org) => ({
      org,
      projects: await listProjects(org.id),
    })),
  );

  if (options.json) {
    console.log(
      JSON.stringify(
        all.flatMap(({ org, projects }) =>
          projects.map((p) => ({ ...p, organizationName: org.name })),
        ),
        null,
        2,
      ),
    );
    return;
  }

  logger.blank();
  for (const { org, projects } of all) {
    logger.log(bold(`${org.name} ${dim(`(${org.id})`)}`));
    if (projects.length === 0) {
      logger.log(dim("  No projects."));
    } else {
      for (const line of renderTable(
        ["NAME", "ID", "MODE", ""],
        projects.map((project) => [
          project.name,
          dim(project.id),
          project.mode ?? "",
          project.id === config.defaultProjectId ? highlight("default") : "",
        ]),
      )) {
        logger.log(line);
      }
    }
    logger.blank();
  }
}

export async function projectsUse(id: string): Promise<void> {
  // Validate the project exists in one of the user's orgs
  const orgs = await listOrganizations();
  for (const org of orgs) {
    const projects = await listProjects(org.id);
    const project = projects.find((p) => p.id === id);
    if (project) {
      await setConfig({ defaultProjectId: id, defaultOrgId: org.id });
      logger.success(
        `Default project set to ${highlight(project.name)} ${dim(`(${id})`)} in ${org.name}.`,
      );
      return;
    }
  }

  logger.error(`Project "${id}" not found in any of your organizations.`);
  process.exit(1);
}

interface CreditsOptions extends JsonOption {
  org?: string;
}

export async function credits(options: CreditsOptions): Promise<void> {
  const orgs = await listOrganizations();
  const config = await getConfig();

  let targets: Organization[] = orgs;
  const filterId = options.org ?? config.defaultOrgId;
  if (filterId) {
    targets = orgs.filter((o) => o.id === filterId || o.name === filterId);
    if (targets.length === 0) {
      logger.error(`Organization "${filterId}" not found.`);
      process.exit(1);
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        targets.map((o) => ({ id: o.id, name: o.name, credits: o.credits })),
        null,
        2,
      ),
    );
    return;
  }

  logger.blank();
  for (const org of targets) {
    logger.log(
      `  ${bold(org.name)} ${dim(`(${org.id})`)}: ${highlight(formatUSD(org.credits))} credits`,
    );
  }
  logger.blank();
}
