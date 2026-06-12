export function formatUSD(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return "—";
  }
  if (num !== 0 && Math.abs(num) < 0.01) {
    return `$${num.toFixed(6)}`;
  }
  return `$${num.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toISOString().replace("T", " ").slice(0, 16);
}

/**
 * Render rows as a padded table. Column widths are derived from content.
 * ANSI color codes are ignored when measuring width.
 */
export function renderTable(headers: string[], rows: string[][]): string[] {
  // eslint-disable-next-line no-control-regex
  const ansi = /\x1b\[[0-9;]*m/g;
  const width = (s: string) => s.replace(ansi, "").length;

  const widths = headers.map((h, i) =>
    Math.max(width(h), ...rows.map((r) => width(r[i] ?? ""))),
  );

  const renderRow = (cells: string[]) =>
    "  " +
    cells
      .map((cell, i) => cell + " ".repeat(widths[i] - width(cell ?? "")))
      .join("  ");

  return [
    renderRow(headers),
    renderRow(widths.map((w) => "-".repeat(w))),
    ...rows.map(renderRow),
  ];
}

const DURATION_UNITS: Record<string, "hour" | "day" | "week" | "month"> = {
  h: "hour",
  hr: "hour",
  hour: "hour",
  hours: "hour",
  d: "day",
  day: "day",
  days: "day",
  w: "week",
  week: "week",
  weeks: "week",
  mo: "month",
  month: "month",
  months: "month",
};

export interface Duration {
  value: number;
  unit: "hour" | "day" | "week" | "month";
}

/**
 * Parse durations like "12h", "30d", "2w", "1mo".
 */
export function parseDuration(input: string): Duration | null {
  const match = /^(\d+)\s*([a-zA-Z]+)$/.exec(input.trim());
  if (!match) {
    return null;
  }
  const unit = DURATION_UNITS[match[2].toLowerCase()];
  if (!unit) {
    return null;
  }
  return { value: parseInt(match[1], 10), unit };
}

/**
 * Resolve a TTL argument to an ISO datetime. Accepts a duration ("30d",
 * "12h") relative to now, or an absolute date/datetime string.
 */
export function resolveExpiry(input: string): string | null {
  const duration = parseDuration(input);
  if (duration) {
    const ms: Record<Duration["unit"], number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(
      Date.now() + duration.value * ms[duration.unit],
    ).toISOString();
  }
  const date = new Date(input);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }
  return null;
}
