import prompts from "prompts";
import { logger, highlight, dim, bold } from "../utils/logger.js";
import { apiRequest, resolveProjectId } from "../utils/api.js";
import {
  formatUSD,
  formatDate,
  renderTable,
  parseDuration,
  resolveExpiry,
} from "../utils/format.js";

export interface ApiKey {
  id: string;
  token?: string;
  maskedToken?: string;
  description: string;
  status: "active" | "inactive" | "deleted";
  usage: string;
  usageLimit: string | null;
  periodUsageLimit: string | null;
  periodUsageDurationValue: number | null;
  periodUsageDurationUnit: string | null;
  currentPeriodUsage: string;
  expiresAt: string | null;
  projectId: string;
  createdAt: string;
}

interface KeysCreateOptions {
  project?: string;
  description?: string;
  limit?: string;
  periodLimit?: string;
  period?: string;
  expires?: string;
  json?: boolean;
}

export async function keysCreate(options: KeysCreateOptions): Promise<void> {
  const projectId = await resolveProjectId(options.project);

  let description = options.description;
  if (!description) {
    const answer = await prompts({
      type: "text",
      name: "description",
      message: "Key description:",
      validate: (value: string) =>
        value.trim().length > 0 || "Description is required",
    });
    if (!answer.description) {
      process.exit(1);
    }
    description = answer.description;
  }

  const body: Record<string, unknown> = { description, projectId };

  if (options.limit) {
    body.usageLimit = options.limit;
  }

  if (options.periodLimit) {
    const period = options.period ?? "1mo";
    const duration = parseDuration(period);
    if (!duration) {
      logger.error(
        `Invalid --period "${period}". Use formats like 12h, 1d, 2w, 1mo.`,
      );
      process.exit(1);
    }
    body.periodUsageLimit = options.periodLimit;
    body.periodUsageDurationValue = duration.value;
    body.periodUsageDurationUnit = duration.unit;
  } else if (options.period) {
    logger.error("--period requires --period-limit to be set.");
    process.exit(1);
  }

  if (options.expires) {
    const expiresAt = resolveExpiry(options.expires);
    if (!expiresAt) {
      logger.error(
        `Invalid --expires "${options.expires}". Use a duration (30d, 12h) or an ISO date.`,
      );
      process.exit(1);
    }
    body.expiresAt = expiresAt;
  }

  const data = await apiRequest<{ apiKey: ApiKey }>("/keys/api", {
    method: "POST",
    body,
  });

  if (options.json) {
    console.log(JSON.stringify(data.apiKey, null, 2));
    return;
  }

  const key = data.apiKey;
  logger.blank();
  logger.success(`API key created: ${bold(key.description)}`);
  logger.blank();
  logger.log(`  ${highlight(key.token ?? "")}`);
  logger.blank();
  logger.warn("Save this token now — it will not be shown again.");
  logger.blank();
  logger.log(`  ${dim("ID:")}            ${key.id}`);
  logger.log(`  ${dim("Project:")}       ${key.projectId}`);
  logger.log(`  ${dim("Budget:")}        ${formatUSD(key.usageLimit)}`);
  if (key.periodUsageLimit) {
    logger.log(
      `  ${dim("Period budget:")} ${formatUSD(key.periodUsageLimit)} per ${key.periodUsageDurationValue} ${key.periodUsageDurationUnit}(s)`,
    );
  }
  logger.log(`  ${dim("Expires:")}       ${formatDate(key.expiresAt)}`);
  logger.blank();
}

interface KeysListOptions {
  project?: string;
  all?: boolean;
  json?: boolean;
}

export async function keysList(options: KeysListOptions): Promise<void> {
  const data = await apiRequest<{
    apiKeys: ApiKey[];
    planLimits?: { currentCount: number; maxKeys: number; plan: string };
  }>("/keys/api", {
    query: {
      projectId: options.project,
      filter: options.all ? "all" : undefined,
    },
  });

  // The API soft-deletes keys and still returns them in lists
  data.apiKeys = data.apiKeys.filter((key) => key.status !== "deleted");

  if (options.json) {
    console.log(JSON.stringify(data.apiKeys, null, 2));
    return;
  }

  logger.blank();
  logger.log(bold(`API keys (${data.apiKeys.length}):`));
  logger.blank();

  if (data.apiKeys.length === 0) {
    logger.log(dim("  No API keys found."));
    logger.log(dim(`  Create one with ${highlight("llmgateway keys create")}`));
    logger.blank();
    return;
  }

  const rows = data.apiKeys.map((key) => [
    key.description,
    dim(key.id),
    key.maskedToken ?? "",
    key.status === "active" ? highlight(key.status) : dim(key.status),
    `${formatUSD(key.usage)} / ${formatUSD(key.usageLimit)}`,
    formatDate(key.expiresAt),
  ]);

  for (const line of renderTable(
    ["DESCRIPTION", "ID", "TOKEN", "STATUS", "SPEND / BUDGET", "EXPIRES"],
    rows,
  )) {
    logger.log(line);
  }

  if (data.planLimits) {
    logger.blank();
    logger.log(
      dim(
        `  ${data.planLimits.currentCount}/${data.planLimits.maxKeys} keys used on the ${data.planLimits.plan} plan`,
      ),
    );
  }
  logger.blank();
}

interface KeysUpdateOptions {
  activate?: boolean;
  deactivate?: boolean;
  expires?: string;
}

export async function keysUpdate(
  id: string,
  options: KeysUpdateOptions,
): Promise<void> {
  if (options.activate && options.deactivate) {
    logger.error("Pass either --activate or --deactivate, not both.");
    process.exit(1);
  }
  if (!options.activate && !options.deactivate) {
    logger.error("Nothing to update. Pass --activate or --deactivate.");
    process.exit(1);
  }

  const body: Record<string, unknown> = {
    status: options.activate ? "active" : "inactive",
  };

  if (options.expires) {
    const expiresAt = resolveExpiry(options.expires);
    if (!expiresAt) {
      logger.error(
        `Invalid --expires "${options.expires}". Use a duration (30d, 12h) or an ISO date.`,
      );
      process.exit(1);
    }
    body.expiresAt = expiresAt;
  }

  const data = await apiRequest<{ apiKey: ApiKey }>(`/keys/api/${id}`, {
    method: "PATCH",
    body,
  });

  logger.success(
    `Key "${data.apiKey.description}" is now ${data.apiKey.status}.`,
  );
}

export interface BudgetOptions {
  limit?: string;
  periodLimit?: string;
  period?: string;
  clear?: boolean;
}

export async function keysSetBudget(
  id: string,
  options: BudgetOptions,
): Promise<void> {
  const body: Record<string, unknown> = {};

  if (options.clear) {
    body.usageLimit = null;
    body.periodUsageLimit = null;
    body.periodUsageDurationValue = null;
    body.periodUsageDurationUnit = null;
  } else {
    if (options.limit) {
      body.usageLimit = options.limit;
    }
    if (options.periodLimit) {
      const period = options.period ?? "1mo";
      const duration = parseDuration(period);
      if (!duration) {
        logger.error(
          `Invalid --period "${period}". Use formats like 12h, 1d, 2w, 1mo.`,
        );
        process.exit(1);
      }
      body.periodUsageLimit = options.periodLimit;
      body.periodUsageDurationValue = duration.value;
      body.periodUsageDurationUnit = duration.unit;
    }
    if (Object.keys(body).length === 0) {
      logger.error(
        "Nothing to set. Pass --limit, --period-limit (with --period), or --clear.",
      );
      process.exit(1);
    }
  }

  const data = await apiRequest<{ apiKey: ApiKey }>(`/keys/api/limit/${id}`, {
    method: "PATCH",
    body,
  });

  const key = data.apiKey;
  logger.blank();
  logger.success(`Budget updated for "${key.description}"`);
  printBudget(key);
}

interface BudgetGetOptions {
  project?: string;
  json?: boolean;
}

export async function keysGetBudget(
  id: string,
  options: BudgetGetOptions,
): Promise<void> {
  const data = await apiRequest<{ apiKeys: ApiKey[] }>("/keys/api", {
    query: { projectId: options.project },
  });

  const key = data.apiKeys.find((k) => k.id === id && k.status !== "deleted");
  if (!key) {
    logger.error(
      `API key "${id}" not found. If it belongs to another project, pass --project <id>.`,
    );
    process.exit(1);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          id: key.id,
          description: key.description,
          usage: key.usage,
          usageLimit: key.usageLimit,
          periodUsageLimit: key.periodUsageLimit,
          periodUsageDurationValue: key.periodUsageDurationValue,
          periodUsageDurationUnit: key.periodUsageDurationUnit,
          currentPeriodUsage: key.currentPeriodUsage,
        },
        null,
        2,
      ),
    );
    return;
  }

  logger.blank();
  logger.log(bold(`Budget for "${key.description}"`));
  printBudget(key);
}

function printBudget(key: ApiKey): void {
  logger.blank();
  logger.log(
    `  ${dim("Total spend:")}   ${formatUSD(key.usage)} / ${formatUSD(key.usageLimit)}${key.usageLimit ? ` ${dim(remainingNote(key.usage, key.usageLimit))}` : ""}`,
  );
  if (key.periodUsageLimit) {
    logger.log(
      `  ${dim("Period spend:")}  ${formatUSD(key.currentPeriodUsage)} / ${formatUSD(key.periodUsageLimit)} per ${key.periodUsageDurationValue} ${key.periodUsageDurationUnit}(s)`,
    );
  } else {
    logger.log(`  ${dim("Period budget:")} ${dim("not set")}`);
  }
  logger.blank();
}

function remainingNote(usage: string, limit: string): string {
  const remaining = parseFloat(limit) - parseFloat(usage);
  if (Number.isNaN(remaining)) {
    return "";
  }
  return remaining <= 0
    ? "(budget exhausted)"
    : `(${formatUSD(remaining)} remaining)`;
}

interface ConfirmableOptions {
  yes?: boolean;
}

export async function keysRoll(
  id: string,
  options: ConfirmableOptions,
): Promise<void> {
  if (!options.yes) {
    const answer = await prompts({
      type: "confirm",
      name: "confirmed",
      message: "Roll this key? The current token stops working immediately.",
      initial: false,
    });
    if (!answer.confirmed) {
      logger.log(dim("Cancelled."));
      return;
    }
  }

  const data = await apiRequest<{ apiKey: ApiKey }>(`/keys/api/${id}/roll`, {
    method: "POST",
  });

  logger.blank();
  logger.success(`Key "${data.apiKey.description}" rolled.`);
  logger.blank();
  logger.log(`  ${highlight(data.apiKey.token ?? "")}`);
  logger.blank();
  logger.warn("Save this token now — it will not be shown again.");
  logger.blank();
}

export async function keysDelete(
  id: string,
  options: ConfirmableOptions,
): Promise<void> {
  if (!options.yes) {
    const answer = await prompts({
      type: "confirm",
      name: "confirmed",
      message: `Delete API key ${id}? This cannot be undone.`,
      initial: false,
    });
    if (!answer.confirmed) {
      logger.log(dim("Cancelled."));
      return;
    }
  }

  await apiRequest<{ message: string }>(`/keys/api/${id}`, {
    method: "DELETE",
  });

  logger.success("API key deleted.");
}
