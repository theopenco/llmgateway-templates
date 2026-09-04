import path from "node:path";
import fs from "fs-extra";
import { AGENTS, type AgentDefinition, type LaunchContext } from "./agents.js";
import { configDir, writePrivateJson } from "./config.js";

/** Portable, explicitly installed definitions. No shell commands or executable hooks. */
export interface CustomAgent {
  id: string;
  label: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  defaultModel?: string;
}

const reserved = new Set(
  AGENTS.flatMap((agent) => [agent.id, ...(agent.aliases ?? [])]),
);
const fields = new Set([
  "id",
  "label",
  "description",
  "command",
  "args",
  "env",
  "defaultModel",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  ) {
    throw new Error(
      `${label} must be a nonempty string without control characters.`,
    );
  }
}

function validateTemplate(value: string, allowKey: boolean): void {
  for (const match of value.matchAll(/\$\{([^}]+)\}/g)) {
    if (
      !["gatewayUrl", "model", ...(allowKey ? ["apiKey"] : [])].includes(
        match[1],
      )
    ) {
      throw new Error(
        `Unsupported placeholder ${match[0]}. API keys are allowed only in env values.`,
      );
    }
  }
}

export function parseCustomAgent(value: unknown): CustomAgent {
  if (!isRecord(value))
    throw new Error("An agent definition must be a JSON object.");
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) throw new Error(`Unknown agent property: ${field}`);
  }
  string(value.id, "id");
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(value.id) || reserved.has(value.id)) {
    throw new Error(
      "Use a unique lowercase agent id (letters, numbers and hyphens), distinct from built-in agents.",
    );
  }
  string(value.label, "label");
  string(value.command, "command");
  if (
    value.command.startsWith("-") ||
    value.command.includes("${") ||
    (!path.isAbsolute(value.command) &&
      !path.win32.isAbsolute(value.command) &&
      !/^[a-zA-Z0-9_.-]+$/.test(value.command))
  ) {
    throw new Error(
      "command must be an executable name or an absolute path. Put arguments in args; shell expressions are not supported.",
    );
  }
  if (value.description !== undefined) string(value.description, "description");
  if (value.defaultModel !== undefined)
    string(value.defaultModel, "defaultModel");
  if (value.args !== undefined) {
    if (!Array.isArray(value.args) || value.args.length > 128)
      throw new Error("args must be an array of up to 128 strings.");
    for (const arg of value.args) {
      string(arg, "argument");
      validateTemplate(arg, false);
    }
  }
  if (value.env !== undefined) {
    if (!isRecord(value.env))
      throw new Error(
        "env must be an object of environment variable names and values.",
      );
    for (const [key, entry] of Object.entries(value.env)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
        throw new Error(`Invalid environment variable: ${key}`);
      string(entry, `env.${key}`);
      validateTemplate(entry, true);
    }
  }
  return value as unknown as CustomAgent;
}

export function customAgentDefinition(
  definition: CustomAgent,
): AgentDefinition {
  const expand = (template: string, ctx: LaunchContext): string =>
    template.replace(
      /\$\{(apiKey|gatewayUrl|model)\}/g,
      (_match, key: "apiKey" | "gatewayUrl" | "model") => {
        const value =
          key === "model" ? (ctx.model ?? definition.defaultModel) : ctx[key];
        if (!value)
          throw new Error(
            `${definition.id} requires a model. Pass --model or set defaultModel in its definition.`,
          );
        return value;
      },
    );
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description ?? "Custom coding agent",
    bin: definition.command,
    supportsModel: [
      ...(definition.args ?? []),
      ...Object.values(definition.env ?? {}),
    ].some((v) => v.includes("${model}")),
    installUrl: "Install the executable specified by your agent definition.",
    guideUrl:
      "https://github.com/theopenco/llmgateway-templates/tree/main/packages/llmgateway-cli#agents---custom-coding-agents",
    env: (ctx) => ({
      LLMGATEWAY_API_KEY: ctx.apiKey,
      LLMGATEWAY_GATEWAY_URL: ctx.gatewayUrl,
      ...Object.fromEntries(
        Object.entries(definition.env ?? {}).map(([key, value]) => [
          key,
          expand(value, ctx),
        ]),
      ),
    }),
    args: (ctx) => (definition.args ?? []).map((arg) => expand(arg, ctx)),
  };
}

export async function readCustomAgents(): Promise<CustomAgent[]> {
  let value: unknown;
  try {
    value = await fs.readJson(path.join(configDir(), "agents.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(
      "Cannot read the custom agent registry. Repair agents.json before continuing.",
      { cause: error },
    );
  }
  if (!Array.isArray(value))
    throw new Error("agents.json must contain an array of agent definitions.");
  const agents = value.map(parseCustomAgent);
  if (new Set(agents.map((agent) => agent.id)).size !== agents.length)
    throw new Error("Duplicate ids in agents.json.");
  return agents;
}

export async function saveCustomAgents(agents: CustomAgent[]): Promise<void> {
  await writePrivateJson(path.join(configDir(), "agents.json"), agents);
}

export async function getAgents(): Promise<AgentDefinition[]> {
  return [...AGENTS, ...(await readCustomAgents()).map(customAgentDefinition)];
}
