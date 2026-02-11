import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { execSync } from "node:child_process";

async function sendToDiscord(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      "Discord is not configured. Set the DISCORD_WEBHOOK_URL environment variable to enable Discord notifications."
    );
    return;
  }

  // Discord has a 2000 character limit per message
  const chunks: string[] = [];
  if (message.length <= 2000) {
    chunks.push(message);
  } else {
    const lines = message.split("\n");
    let current = "";
    for (const line of lines) {
      if (current.length + line.length + 1 > 2000) {
        chunks.push(current);
        current = line;
      } else {
        current += (current ? "\n" : "") + line;
      }
    }
    if (current) chunks.push(current);
  }

  for (const chunk of chunks) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: chunk }),
    });

    if (!response.ok) {
      console.error(
        `Failed to send to Discord: ${response.status} ${response.statusText}`
      );
      return;
    }
  }

  console.log("Changelog sent to Discord successfully.");
}

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

function getGitRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return process.cwd();
  }
}

const gitRoot = getGitRoot();

const getGitLogTool = tool({
  description:
    "Get the git commit log for a given range. Returns commit hashes, authors, dates, and messages.",
  inputSchema: z.object({
    range: z
      .string()
      .optional()
      .describe(
        "Git revision range, e.g., 'v1.0.0..v2.0.0' or 'HEAD~10..HEAD'. Omit for recent commits."
      ),
    maxCount: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of commits to return"),
  }),
  execute: async ({ range, maxCount }) => {
    const rangeArg = range ? `${range} ` : "";
    const cmd = `git log ${rangeArg}--pretty=format:"%h %s (%an, %ad)" --date=short -n ${maxCount}`;
    try {
      const output = execSync(cmd, {
        encoding: "utf-8",
        timeout: 10000,
        cwd: gitRoot,
      });
      return { success: true, log: output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to run git log: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

const getGitDiffTool = tool({
  description:
    "Get a summary of file changes (insertions, deletions, files changed) for a given range.",
  inputSchema: z.object({
    range: z
      .string()
      .optional()
      .describe(
        "Git revision range, e.g., 'v1.0.0..v2.0.0'. Omit for unstaged changes."
      ),
  }),
  execute: async ({ range }) => {
    const rangeArg = range ? `${range} ` : "";
    const cmd = `git diff --stat ${rangeArg}`.trim();
    try {
      const output = execSync(cmd, {
        encoding: "utf-8",
        timeout: 10000,
        cwd: gitRoot,
      });
      return { success: true, diff: output };
    } catch (error) {
      return {
        success: false,
        error: `Failed to run git diff: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

async function runChangelogAgent(range?: string): Promise<string> {
  const prompt = range
    ? `Generate a changelog for the git range: ${range}`
    : "Generate a changelog for the most recent commits in this repository.";

  const result = await generateText({
    model: llmgateway("openai/gpt-4o-mini"),
    tools: {
      getGitLog: getGitLogTool,
      getGitDiff: getGitDiffTool,
    },
    stopWhen: stepCountIs(5),
    system: `You are a changelog generator. Your job is to analyze git history and produce a well-structured changelog following the Keep a Changelog format (https://keepachangelog.com).

Use the available tools to inspect the git log and diff, then organize the changes into these categories:
- **Added** — new features
- **Changed** — changes to existing functionality
- **Deprecated** — features that will be removed
- **Removed** — removed features
- **Fixed** — bug fixes
- **Security** — vulnerability fixes

Only include categories that have entries. Write clear, concise descriptions from a user's perspective. Group related commits together.`,
    prompt,
  });

  return result.text;
}

async function main() {
  const range = process.argv[2];

  console.log("Changelog Generator Agent - Powered by LLM Gateway\n");
  console.log("=".repeat(50));
  console.log(
    `\nGenerating changelog${range ? ` for range: ${range}` : " for recent commits"}...`
  );
  console.log("-".repeat(50));

  const response = await runChangelogAgent(range);
  console.log(`\n${response}`);
  console.log("\n" + "=".repeat(50));

  await sendToDiscord(response);
}

main().catch(console.error);
