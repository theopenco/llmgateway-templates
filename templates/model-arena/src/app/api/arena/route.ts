import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type StepResult,
  type ToolSet,
} from "ai";
import type { ArenaMessage, RunMetrics } from "@/lib/arena";

export const maxDuration = 120;

type GatewayMetadata = { llmgateway?: { usage?: { cost?: number } } };

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;
  if (!apiKey)
    return Response.json({ error: "An API key is required." }, { status: 401 });

  let model: string;
  let messages: ArenaMessage[];
  try {
    const body = await request.json();
    if (typeof body.model !== "string" || !body.model)
      throw new Error("Invalid model");
    model = body.model;
    messages = await validateUIMessages<ArenaMessage>({
      messages: body.messages,
    });
  } catch {
    return Response.json({ error: "Invalid arena request." }, { status: 400 });
  }

  const llmgateway = createLLMGateway({
    apiKey,
    baseURL: process.env.LLMGATEWAY_GATEWAY_URL
      ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
      : undefined,
  });

  const startedAt = performance.now();
  let lastStep: StepResult<ToolSet> | undefined;

  const result = streamText({
    model: llmgateway(model, { usage: { include: true } }),
    instructions:
      "You are being compared side by side with other models. Answer the user's prompt as well as you can. Use markdown when it helps.",
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    onStepEnd(step) {
      lastStep = step;
    },
  });

  const metrics = (): RunMetrics => {
    const totalMs = performance.now() - startedAt;
    const usage = lastStep?.usage;
    const cost = (lastStep?.providerMetadata as GatewayMetadata | undefined)
      ?.llmgateway?.usage?.cost;
    const firstTokenMs = lastStep?.performance.timeToFirstOutputMs ?? null;
    return {
      model,
      firstTokenMs,
      totalMs,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      tokensPerSecond: lastStep?.performance.outputTokensPerSecond ?? null,
      costUsd: typeof cost === "number" ? cost : null,
    };
  };

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<ToolSet, ArenaMessage>({
      stream: result.stream,
      originalMessages: messages,
      messageMetadata: ({ part }) =>
        part.type === "finish" ? metrics() : undefined,
    }),
  });
}
