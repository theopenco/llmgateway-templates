import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText } from "ai";

const ACTION_PROMPTS: Record<string, (text: string, tone?: string) => string> = {
  rewrite: (text) =>
    `Rewrite the following text to improve clarity and flow while preserving the original meaning. Return only the rewritten text.\n\n${text}`,
  summarize: (text) =>
    `Summarize the following text concisely. Return only the summary.\n\n${text}`,
  expand: (text) =>
    `Expand the following text with more detail and context while keeping the same tone. Return only the expanded text.\n\n${text}`,
  "fix-grammar": (text) =>
    `Fix all grammar, spelling, and punctuation errors in the following text. Return only the corrected text.\n\n${text}`,
  "change-tone": (text, tone) =>
    `Rewrite the following text in a ${tone || "professional"} tone. Return only the rewritten text.\n\n${text}`,
};

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

    const llmgateway = createLLMGateway({ apiKey });

    const { text, action, tone } = await request.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    if (!action || !ACTION_PROMPTS[action]) {
      return Response.json(
        { error: "Invalid action. Use: rewrite, summarize, expand, fix-grammar, or change-tone" },
        { status: 400 }
      );
    }

    const prompt = ACTION_PROMPTS[action](text, tone);

    const result = await generateText({
      model: llmgateway("openai/gpt-4o-mini"),
      prompt,
    });

    return Response.json({ result: result.text });
  } catch (error) {
    console.error("Writing assist error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process text",
      },
      { status: 500 }
    );
  }
}
