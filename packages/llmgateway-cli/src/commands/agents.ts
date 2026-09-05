import fs from "fs-extra";
import {
  getAgents,
  parseCustomAgent,
  readCustomAgents,
  saveCustomAgents,
} from "../utils/custom-agents.js";
import { isAgentInstalled } from "../utils/agents.js";
import { logger } from "../utils/logger.js";

export async function agentsList(
  options: { json?: boolean } = {},
): Promise<void> {
  const agents = (await getAgents()).map((agent) => ({
    id: agent.id,
    label: agent.label,
    command: agent.bin,
    installed: isAgentInstalled(agent),
    description: agent.description,
  }));
  if (options.json) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }
  for (const agent of agents)
    logger.log(
      `${agent.id.padEnd(20)} ${agent.label}${agent.installed ? "" : " (not installed)"}`,
    );
}

export async function agentsAdd(
  file: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const agent = parseCustomAgent(await fs.readJson(file));
  const agents = await readCustomAgents();
  const existing = agents.findIndex((entry) => entry.id === agent.id);
  if (existing >= 0 && !options.force)
    throw new Error(
      `Agent ${agent.id} already exists. Use --force to replace it.`,
    );
  if (existing >= 0) agents[existing] = agent;
  else agents.push(agent);
  await saveCustomAgents(agents);
  logger.success(
    `Registered ${agent.label}. Launch with: llmgateway launch ${agent.id}`,
  );
}

export async function agentsRemove(id: string): Promise<void> {
  const agents = await readCustomAgents();
  if (!agents.some((agent) => agent.id === id))
    throw new Error(`Custom agent ${id} not found.`);
  await saveCustomAgents(agents.filter((agent) => agent.id !== id));
  logger.success(`Removed custom agent ${id}.`);
}

export async function agentsShow(id: string): Promise<void> {
  const agent = (await readCustomAgents()).find((agent) => agent.id === id);
  if (!agent) throw new Error(`Custom agent ${id} not found.`);
  console.log(JSON.stringify(agent, null, 2));
}
