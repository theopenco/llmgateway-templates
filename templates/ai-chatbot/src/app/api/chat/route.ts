import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { streamText } from "ai";

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  const llmgateway = createLLMGateway({ apiKey });

  const { messages, model } = await request.json();

  const result = streamText({
    model: llmgateway(model || "openai/gpt-4o-mini"),
    system:
      "You are a helpful, friendly assistant. Provide clear and concise answers. Use markdown formatting when appropriate.",
    messages,
  });

  return result.toTextStreamResponse();
}
