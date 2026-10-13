import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { ToolLoopAgent, isStepCount, tool } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  baseURL: process.env.LLMGATEWAY_GATEWAY_URL
    ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
    : undefined,
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const MODEL = process.env.LLMGATEWAY_MODEL || "gpt-6.1-sol";
const SEARCH_MODEL = process.env.LLMGATEWAY_SEARCH_MODEL || "gpt-6-luna";
const MAX_PAGE_CHARS = 12_000;

const searcher = llmgateway(SEARCH_MODEL, {
  extraBody: { web_search: true },
});

function htmlToText(html: string): string {
  return html
    .replace(
      /<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const webSearch = tool({
  description:
    "Search the live web. Returns a short answer with source links. Use focused queries and call it several times for different angles.",
  inputSchema: z.object({
    query: z.string().describe("A focused web search query"),
  }),
  execute: async ({ query }, { abortSignal }) => {
    const agent = new ToolLoopAgent({
      model: searcher,
      instructions:
        "Search the web and answer with the key facts, numbers and dates. List every source as a markdown link.",
    });
    const result = await agent.generate({ prompt: query, abortSignal });
    return { query, findings: result.text };
  },
});

const readPage = tool({
  description:
    "Fetch a web page and return its readable text. Use it to verify a claim or get details from a source found with webSearch.",
  inputSchema: z.object({
    url: z.url().describe("The absolute URL to read"),
  }),
  execute: async ({ url }, { abortSignal }) => {
    const { protocol } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") {
      return { url, error: "Only http(s) URLs are supported." };
    }
    try {
      const response = await fetch(url, {
        signal: abortSignal,
        redirect: "follow",
        headers: { "user-agent": "llmgateway-research-agent/1.0" },
      });
      if (!response.ok) return { url, error: `HTTP ${response.status}` };
      const type = response.headers.get("content-type") ?? "";
      const body = await response.text();
      const text = type.includes("html") ? htmlToText(body) : body;
      return {
        url,
        text:
          text.length > MAX_PAGE_CHARS
            ? `${text.slice(0, MAX_PAGE_CHARS)}\n…(truncated)`
            : text,
      };
    } catch (error) {
      return {
        url,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

const researcher = new ToolLoopAgent({
  model: llmgateway(MODEL),
  tools: { webSearch, readPage },
  stopWhen: isStepCount(12),
  instructions: `You are a meticulous research analyst. Today is ${new Date().toISOString().slice(0, 10)}.

Process:
1. Break the question into 3-5 sub-questions.
2. Run webSearch for each sub-question. Prefer primary sources (official docs, filings, papers, announcements).
3. Use readPage on the most important sources to confirm numbers and quotes.
4. Write the final report only after you have evidence for each claim.

Report format (markdown):
# <Title>
**TL;DR** — 2-3 sentences.
## Key findings
Bulleted findings, each ending with a numbered citation like [1].
## Details
Short sections that explain the findings and trade-offs.
## Open questions
What the sources disagree on or do not answer.
## Sources
Numbered list of markdown links matching the citations.

Never invent sources. If evidence is thin, say so.`,
});

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "report"
  );
}

async function main() {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question || question === "--help") {
    console.log("Research Agent - Powered by LLM Gateway\n");
    console.log("Usage: pnpm start <question>\n");
    console.log("Examples:");
    console.log(
      '  pnpm start "How do the top vector databases compare on cost?"',
    );
    console.log('  pnpm start "What changed in the EU AI Act this year?"');
    process.exit(question ? 0 : 1);
  }

  console.log("Research Agent - Powered by LLM Gateway\n");
  console.log(`Question: ${question}`);
  console.log(`Models:   ${MODEL} (writer), ${SEARCH_MODEL} (web search)\n`);

  const result = await researcher.generate({
    prompt: question,
    onToolExecutionStart({ toolCall }) {
      const input = toolCall.input as { query?: string; url?: string };
      const label = input.query ?? input.url ?? "";
      console.log(`  → ${toolCall.toolName}: ${label}`);
    },
  });

  const dir = path.resolve("reports");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slugify(question)}.md`);
  await writeFile(file, `${result.text}\n`);

  console.log(`\n${result.text}\n`);
  console.log("-".repeat(50));
  console.log(
    `Steps: ${result.steps.length} · Tokens: ${result.usage.totalTokens ?? 0}`,
  );
  console.log(`Saved report to ${path.relative(process.cwd(), file)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
