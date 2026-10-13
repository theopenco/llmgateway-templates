import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { ToolLoopAgent, hasToolCall, isStepCount, tool } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  baseURL: process.env.LLMGATEWAY_GATEWAY_URL
    ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
    : undefined,
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const MODEL = process.env.LLMGATEWAY_MODEL || "claude-sonnet-5-5";
const MAX_DIFF_CHARS = 60_000;
const MAX_FILE_CHARS = 20_000;
const MAX_STEPS = 12;

const { values } = parseArgs({
  options: {
    base: { type: "string", short: "b" },
    staged: { type: "boolean", short: "s", default: false },
    repo: { type: "string", short: "r" },
    strict: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const repoDir = path.resolve(
  values.repo ?? process.env.INIT_CWD ?? process.cwd(),
);

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoDir,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

const root = git(["rev-parse", "--show-toplevel"]).trim();

function diffArgs(base: string | undefined, staged: boolean): string[] {
  if (staged) return ["diff", "--cached"];
  if (base) return ["diff", `${base}...HEAD`];
  return ["diff", "HEAD"];
}

function insideRepo(file: string): string | null {
  const resolved = path.resolve(root, file);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

const findingSchema = z.object({
  severity: z
    .enum(["critical", "major", "minor", "nit"])
    .describe(
      "critical = security hole or data loss, major = bug or broken behavior, minor = maintainability risk, nit = style",
    ),
  file: z.string().describe("Path relative to the repository root"),
  line: z
    .number()
    .nullable()
    .describe("Line number in the new version of the file, if known"),
  title: z.string().describe("One-line summary of the problem"),
  detail: z.string().describe("Why it is a problem and when it happens"),
  suggestion: z.string().describe("Concrete fix, code allowed"),
});

const reviewSchema = z.object({
  summary: z.string().describe("2-3 sentences on what the change does"),
  verdict: z.enum(["approve", "comment", "request_changes"]),
  findings: z.array(findingSchema),
});

type Review = z.infer<typeof reviewSchema>;

function createReviewer(base: string | undefined, staged: boolean) {
  return new ToolLoopAgent({
    model: llmgateway(MODEL),
    stopWhen: [hasToolCall("submitReview"), isStepCount(MAX_STEPS)],
    prepareStep: ({ stepNumber }) =>
      stepNumber >= MAX_STEPS - 2
        ? { activeTools: ["submitReview"], toolChoice: "required" }
        : {},
    tools: {
      submitReview: tool({
        description:
          "Submit the final review. Call it exactly once, after you have inspected the change.",
        inputSchema: reviewSchema,
      }),
      listChangedFiles: tool({
        description: "List files changed in this review with line counts.",
        inputSchema: z.object({}),
        execute: async () => ({
          files: git([...diffArgs(base, staged), "--numstat"]).trim(),
        }),
      }),
      getDiff: tool({
        description:
          "Get the unified diff. Pass a file path to see one file, or omit it for the whole change.",
        inputSchema: z.object({
          file: z
            .string()
            .optional()
            .describe("Path relative to the repo root"),
        }),
        execute: async ({ file }) => {
          if (file && !insideRepo(file)) return { error: "Path outside repo" };
          const diff = git([
            ...diffArgs(base, staged),
            "--unified=5",
            ...(file ? ["--", file] : []),
          ]);
          return {
            diff:
              diff.length > MAX_DIFF_CHARS
                ? `${diff.slice(0, MAX_DIFF_CHARS)}\n…(truncated, request single files)`
                : diff,
          };
        },
      }),
      readFile: tool({
        description:
          "Read a file from the working tree to understand surrounding code. Supports an optional line window.",
        inputSchema: z.object({
          file: z.string().describe("Path relative to the repo root"),
          startLine: z.number().optional(),
          endLine: z.number().optional(),
        }),
        execute: async ({ file, startLine, endLine }) => {
          const resolved = insideRepo(file);
          if (!resolved || !existsSync(resolved)) {
            return { error: `File not found: ${file}` };
          }
          if (statSync(resolved).size > 2_000_000) {
            return { error: "File too large" };
          }
          const lines = readFileSync(resolved, "utf-8").split("\n");
          const from = (startLine ?? 1) - 1;
          const to = endLine ?? lines.length;
          const text = lines
            .slice(from, to)
            .map((line, i) => `${from + i + 1}: ${line}`)
            .join("\n");
          return {
            content:
              text.length > MAX_FILE_CHARS
                ? `${text.slice(0, MAX_FILE_CHARS)}\n…(truncated)`
                : text,
          };
        },
      }),
    },
    instructions: `You are a senior engineer doing a pull request review.

Workflow:
1. Call listChangedFiles, then getDiff.
2. Use readFile around changed lines whenever the diff alone is not enough to judge correctness.
3. Report only real problems: bugs, security issues, race conditions, missing error handling at boundaries, broken contracts, performance traps, and missing tests for risky logic.
4. Do not report formatting or personal preference unless it hides a bug. Use "nit" sparingly.
5. Each finding must point at a file and, when possible, the line in the new code.

Finish by calling submitReview. Verdict: "request_changes" if any critical or major finding, "comment" if only minor or nit findings, otherwise "approve".`,
  });
}

const ICON: Record<Review["findings"][number]["severity"], string> = {
  critical: "🔴",
  major: "🟠",
  minor: "🟡",
  nit: "⚪",
};

const ORDER = ["critical", "major", "minor", "nit"] as const;

function toMarkdown(review: Review): string {
  const findings = [...review.findings].sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity),
  );
  const lines = [
    "## 🤖 AI code review",
    "",
    review.summary,
    "",
    `**Verdict:** \`${review.verdict}\` · **Findings:** ${findings.length}`,
    "",
  ];
  for (const f of findings) {
    const where = f.line ? `${f.file}:${f.line}` : f.file;
    lines.push(
      `### ${ICON[f.severity]} ${f.title}`,
      `\`${where}\` · ${f.severity}`,
      "",
      f.detail,
      "",
      `**Fix:** ${f.suggestion}`,
      "",
    );
  }
  lines.push(`<sub>Reviewed by ${MODEL} via LLM Gateway</sub>`);
  return lines.join("\n");
}

async function main() {
  if (values.help) {
    console.log("Code Review Agent - Powered by LLM Gateway\n");
    console.log(
      "Usage: pnpm start [--base <ref>] [--staged] [--repo <path>] [--strict] [--json]\n",
    );
    console.log(
      "  --base <ref>  Review HEAD against a base branch (e.g. origin/main)",
    );
    console.log("  --staged      Review staged changes only");
    console.log(
      "  --repo <path> Repository to review (defaults to the current directory)",
    );
    console.log(
      "  --strict      Exit with code 1 on critical or major findings",
    );
    console.log("  --json        Print the raw JSON review");
    return;
  }

  const base = values.base;
  const staged = values.staged ?? false;
  const changed = git([...diffArgs(base, staged), "--name-only"]).trim();
  if (!changed) {
    console.log("No changes to review.");
    return;
  }

  const target = staged
    ? "staged changes"
    : base
      ? `HEAD vs ${base}`
      : "working tree vs HEAD";
  console.error(`Reviewing ${target} with ${MODEL}…`);

  const result = await createReviewer(base, staged).generate({
    prompt: `Review the ${target}.`,
    onToolExecutionStart({ toolCall }) {
      const input = toolCall.input as { file?: string };
      console.error(
        `  → ${toolCall.toolName}${input.file ? ` ${input.file}` : ""}`,
      );
    },
  });

  const submitted = result.staticToolCalls.find(
    (call) => call.toolName === "submitReview",
  );
  if (!submitted)
    throw new Error("The model finished without submitting a review.");
  const review = reviewSchema.parse(submitted.input);
  const markdown = toMarkdown(review);
  console.log(values.json ? JSON.stringify(review, null, 2) : `\n${markdown}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }

  const blocking = review.findings.some(
    (f) => f.severity === "critical" || f.severity === "major",
  );
  if (values.strict && blocking) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
