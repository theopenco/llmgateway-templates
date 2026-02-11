import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { streamText } from "ai";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

export async function POST(request: Request) {
  const { messages, model } = await request.json();

  const result = streamText({
    model: llmgateway(model || "openai/gpt-4o-mini"),
    system:
      "You are a helpful, friendly assistant. Provide clear and concise answers. Use markdown formatting when appropriate.",
    messages,
  });

  return result.toTextStreamResponse();
}
