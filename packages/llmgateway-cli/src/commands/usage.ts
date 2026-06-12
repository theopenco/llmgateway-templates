import { logger, highlight, dim, bold } from "../utils/logger.js";
import { apiRequest, listOrganizations, listProjects } from "../utils/api.js";
import { getConfig } from "../utils/config.js";
import {
  formatUSD,
  formatNumber,
  formatDate,
  renderTable,
} from "../utils/format.js";

interface ActivityRow {
  date: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  errorCount: number;
  errorRate: number;
  modelBreakdown?: BreakdownRow[];
  apiKeyBreakdown?: (BreakdownRow & { description?: string })[];
}

interface BreakdownRow {
  id: string;
  provider?: string;
  description?: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

interface ActivityResponse {
  activity: ActivityRow[];
  granularity?: "hourly" | "daily";
}

type TimeRange = "1h" | "4h" | "24h" | "7d" | "30d" | "365d";
const TIME_RANGES: TimeRange[] = ["1h", "4h", "24h", "7d", "30d", "365d"];

interface UsageOptions {
  org?: string;
  project?: string;
  apiKey?: string;
  by?: string;
  range?: string;
  days?: string;
  from?: string;
  to?: string;
  json?: boolean;
}

export async function usage(options: UsageOptions): Promise<void> {
  if (options.range && !TIME_RANGES.includes(options.range as TimeRange)) {
    logger.error(
      `Invalid --range "${options.range}". Use one of: ${TIME_RANGES.join(", ")}.`,
    );
    process.exit(1);
  }

  if (options.by && !["model", "key"].includes(options.by)) {
    logger.error(`Invalid --by "${options.by}". Use "model" or "key".`);
    process.exit(1);
  }

  if (options.org) {
    await usageByOrg(options);
    return;
  }

  const config = await getConfig();
  const projectId = options.project ?? config.defaultProjectId;

  const data = await fetchActivity({
    projectId,
    apiKeyId: options.apiKey,
    groupBy:
      options.by === "model"
        ? "model"
        : options.by === "key"
          ? "apiKey"
          : undefined,
    range: options.range,
    days: options.days,
    from: options.from,
    to: options.to,
  });

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  printScope(options, projectId);
  printSummary(data.activity);

  if (options.by === "model") {
    printBreakdown(
      "Usage by model",
      aggregateBreakdown(data.activity.map((row) => row.modelBreakdown ?? [])),
      (row) => `${row.id}${row.provider ? dim(` (${row.provider})`) : ""}`,
    );
  } else if (options.by === "key") {
    printBreakdown(
      "Usage by API key",
      aggregateBreakdown(data.activity.map((row) => row.apiKeyBreakdown ?? [])),
      (row) => `${row.description ?? row.id} ${dim(row.id)}`,
    );
  } else {
    printTimeline(data.activity, data.granularity);
  }
}

async function usageByOrg(options: UsageOptions): Promise<void> {
  const orgs = await listOrganizations();
  const org = orgs.find((o) => o.id === options.org || o.name === options.org);
  if (!org) {
    logger.error(`Organization "${options.org}" not found.`);
    logger.log(
      dim(
        `Run ${highlight("llmgateway orgs list")} to see your organizations.`,
      ),
    );
    process.exit(1);
    return;
  }

  const projects = await listProjects(org.id);
  if (projects.length === 0) {
    logger.warn(`Organization "${org.name}" has no projects.`);
    return;
  }

  const results = await Promise.all(
    projects.map(async (project) => ({
      project,
      data: await fetchActivity({
        projectId: project.id,
        range: options.range,
        days: options.days,
        from: options.from,
        to: options.to,
      }),
    })),
  );

  if (options.json) {
    console.log(
      JSON.stringify(
        results.map(({ project, data }) => ({
          projectId: project.id,
          projectName: project.name,
          activity: data.activity,
        })),
        null,
        2,
      ),
    );
    return;
  }

  logger.blank();
  logger.log(
    bold(`Usage for organization ${highlight(org.name)}`) +
      dim(` (${rangeLabel(options)})`),
  );

  const rows = results.map(({ project, data }) => {
    const totals = sumRows(data.activity);
    return [
      project.name,
      dim(project.id),
      formatNumber(totals.requestCount),
      formatNumber(totals.totalTokens),
      formatUSD(totals.cost),
    ];
  });

  const overall = sumRows(results.flatMap(({ data }) => data.activity));
  rows.push([
    bold("TOTAL"),
    "",
    bold(formatNumber(overall.requestCount)),
    bold(formatNumber(overall.totalTokens)),
    bold(formatUSD(overall.cost)),
  ]);

  logger.blank();
  for (const line of renderTable(
    ["PROJECT", "ID", "REQUESTS", "TOKENS", "COST"],
    rows,
  )) {
    logger.log(line);
  }
  logger.blank();
}

interface FetchActivityParams {
  projectId?: string;
  apiKeyId?: string;
  groupBy?: "model" | "apiKey";
  range?: string;
  days?: string;
  from?: string;
  to?: string;
}

async function fetchActivity(
  params: FetchActivityParams,
): Promise<ActivityResponse> {
  const hasExplicitWindow = params.days || params.from || params.to;
  return apiRequest<ActivityResponse>("/activity", {
    query: {
      projectId: params.projectId,
      apiKeyId: params.apiKeyId,
      groupBy: params.groupBy,
      timeRange: hasExplicitWindow ? undefined : (params.range ?? "7d"),
      days: params.days,
      from: params.from,
      to: params.to,
    },
  });
}

function rangeLabel(options: UsageOptions): string {
  if (options.from || options.to) {
    return `${options.from ?? "…"} → ${options.to ?? "now"}`;
  }
  if (options.days) {
    return `last ${options.days} days`;
  }
  return `last ${options.range ?? "7d"}`;
}

function printScope(options: UsageOptions, projectId?: string): void {
  logger.blank();
  const scope = [
    projectId ? `project ${highlight(projectId)}` : "all projects",
    options.apiKey ? `key ${highlight(options.apiKey)}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  logger.log(bold(`Usage — ${scope}`) + dim(` (${rangeLabel(options)})`));
}

function sumRows(rows: ActivityRow[]) {
  return rows.reduce(
    (acc, row) => ({
      requestCount: acc.requestCount + row.requestCount,
      inputTokens: acc.inputTokens + row.inputTokens,
      outputTokens: acc.outputTokens + row.outputTokens,
      totalTokens: acc.totalTokens + row.totalTokens,
      cost: acc.cost + row.cost,
      errorCount: acc.errorCount + row.errorCount,
    }),
    {
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      errorCount: 0,
    },
  );
}

function printSummary(rows: ActivityRow[]): void {
  const totals = sumRows(rows);
  logger.blank();
  logger.log(
    `  ${dim("Requests:")} ${formatNumber(totals.requestCount)}   ${dim("Tokens:")} ${formatNumber(totals.totalTokens)} ${dim(`(${formatNumber(totals.inputTokens)} in / ${formatNumber(totals.outputTokens)} out)`)}`,
  );
  logger.log(
    `  ${dim("Cost:")}     ${formatUSD(totals.cost)}   ${dim("Errors:")} ${formatNumber(totals.errorCount)}`,
  );
}

function printTimeline(
  rows: ActivityRow[],
  granularity?: "hourly" | "daily",
): void {
  const active = rows.filter((row) => row.requestCount > 0);
  if (active.length === 0) {
    logger.blank();
    logger.log(dim("  No usage in this period."));
    logger.blank();
    return;
  }

  const tableRows = active.map((row) => [
    granularity === "hourly"
      ? row.date.replace("T", " ").slice(0, 16)
      : row.date,
    formatNumber(row.requestCount),
    formatNumber(row.totalTokens),
    formatUSD(row.cost),
    row.errorCount > 0 ? `${formatNumber(row.errorCount)}` : dim("0"),
  ]);

  logger.blank();
  for (const line of renderTable(
    [
      granularity === "hourly" ? "HOUR" : "DATE",
      "REQUESTS",
      "TOKENS",
      "COST",
      "ERRORS",
    ],
    tableRows,
  )) {
    logger.log(line);
  }
  logger.blank();
  logger.log(
    dim(
      `  Tip: add ${highlight("--by model")} or ${highlight("--by key")} for a breakdown.`,
    ),
  );
  logger.blank();
}

function aggregateBreakdown(perDay: BreakdownRow[][]): BreakdownRow[] {
  const byId = new Map<string, BreakdownRow>();
  for (const rows of perDay) {
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (existing) {
        existing.requestCount += row.requestCount;
        existing.inputTokens += row.inputTokens;
        existing.outputTokens += row.outputTokens;
        existing.totalTokens += row.totalTokens;
        existing.cost += row.cost;
      } else {
        byId.set(row.id, { ...row });
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.cost - a.cost);
}

function printBreakdown(
  title: string,
  rows: BreakdownRow[],
  label: (row: BreakdownRow) => string,
): void {
  logger.blank();
  logger.log(bold(title));
  logger.blank();

  if (rows.length === 0) {
    logger.log(dim("  No usage in this period."));
    logger.blank();
    return;
  }

  for (const line of renderTable(
    ["", "REQUESTS", "TOKENS", "COST"],
    rows.map((row) => [
      label(row),
      formatNumber(row.requestCount),
      formatNumber(row.totalTokens),
      formatUSD(row.cost),
    ]),
  )) {
    logger.log(line);
  }
  logger.blank();
}

interface SourcesOptions {
  project?: string;
  range?: string;
  from?: string;
  to?: string;
  json?: boolean;
}

interface SourceRow {
  source: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  lastUsedAt: string | null;
}

export async function usageSources(options: SourcesOptions): Promise<void> {
  const config = await getConfig();
  const projectId = options.project ?? config.defaultProjectId;

  if (!projectId) {
    logger.error(
      "A project is required. Pass --project <id> or set a default with `llmgateway projects use <id>`.",
    );
    process.exit(1);
  }

  if (options.range && !["7d", "30d"].includes(options.range)) {
    logger.error(`Invalid --range "${options.range}". Use 7d or 30d.`);
    process.exit(1);
  }

  const data = await apiRequest<{ sources: SourceRow[] }>("/activity/sources", {
    query: {
      projectId,
      timeRange:
        options.from || options.to ? undefined : (options.range ?? "7d"),
      from: options.from,
      to: options.to,
    },
  });

  if (options.json) {
    console.log(JSON.stringify(data.sources, null, 2));
    return;
  }

  logger.blank();
  logger.log(bold(`Usage by session source — project ${highlight(projectId)}`));
  logger.blank();

  if (data.sources.length === 0) {
    logger.log(dim("  No session/source usage in this period."));
    logger.blank();
    return;
  }

  for (const line of renderTable(
    ["SOURCE", "REQUESTS", "TOKENS", "COST", "LAST USED"],
    data.sources.map((row) => [
      row.source || dim("(unlabeled)"),
      formatNumber(row.requestCount),
      formatNumber(row.totalTokens),
      formatUSD(row.cost),
      formatDate(row.lastUsedAt),
    ]),
  )) {
    logger.log(line);
  }
  logger.blank();
}
