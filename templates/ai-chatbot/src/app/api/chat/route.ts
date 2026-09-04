import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { streamText, convertToModelMessages, validateUIMessages } from "ai";

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;
  if (!apiKey)
    return Response.json({ error: "An API key is required." }, { status: 401 });

  const llmgateway = createLLMGateway({
    apiKey,
    baseURL: process.env.LLMGATEWAY_GATEWAY_URL
      ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
      : undefined,
  });

  let body;
  let messages;
  try {
    body = await request.json();
    if (body.model !== undefined && typeof body.model !== "string")
      throw new Error("Invalid model");
    messages = await validateUIMessages({ messages: body.messages });
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const result = streamText({
    model: llmgateway(
      body.model || process.env.LLMGATEWAY_MODEL || "gpt-5.4-mini",
    ),
    system:
      "You are a helpful, friendly assistant. Provide clear and concise answers. Use markdown formatting when appropriate.",
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse();
}
