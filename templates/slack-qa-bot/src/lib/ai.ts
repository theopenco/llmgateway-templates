import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { ToolLoopAgent } from "ai";
import type { AiMessage } from "chat";

/**
 * Default model served through LLM Gateway. Override with the `AI_MODEL`
 * environment variable (any `provider/model` id from https://llmgateway.io/models).
 */
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions for a team inside Slack.

Guidelines:
- Be concise and direct. Slack messages are read quickly, so lead with the answer.
- Use Slack-friendly markdown: short paragraphs, bullet lists, and fenced code blocks for code.
- You have live web search. For current events, recent releases, prices, docs, or anything time-sensitive, search the web and base your answer on the results instead of guessing.
- When you rely on web results, cite your sources inline as markdown links, e.g. [Anthropic](https://anthropic.com).
- If you are unsure or lack the context to answer, say so plainly instead of guessing.
- When a question is ambiguous, ask one clarifying question rather than assuming.
- Messages may be prefixed with "[username]:" to show who is speaking in a multi-person thread.`;

/** Web search is on by default; set WEB_SEARCH=false to disable it. */
const webSearchEnabled = process.env.WEB_SEARCH !== "false";

/**
 * LLM Gateway provider. Reads `LLM_GATEWAY_API_KEY` (and optional
 * `LLM_GATEWAY_API_BASE`) from the environment automatically.
 */
export const gateway = createLLMGateway();

export const model = process.env.AI_MODEL ?? DEFAULT_MODEL;

// The provider types model ids as a literal union, but `AI_MODEL` is an
// arbitrary runtime string, so we assert it into the expected id type.
const modelId = model as Parameters<typeof gateway>[0];

// LLM Gateway runs web search server-side when `web_search` is set on the
// request body. The AI SDK provider passes `extraBody` straight through.
export const agent = new ToolLoopAgent({
  instructions: SYSTEM_PROMPT,
  model: gateway(
    modelId,
    webSearchEnabled ? { extraBody: { web_search: true } } : {},
  ),
});

/**
 * Stream an answer for the given prompt. Accepts either a plain question
 * string or a conversation history produced by `toAiMessages()`.
 *
 * Returns the AI SDK `fullStream` so step boundaries are preserved when piped
 * into `thread.post()`.
 */
export const answer = async (prompt: string | AiMessage[]) => {
  const result = await agent.stream({ prompt });
  return result.fullStream;
};
