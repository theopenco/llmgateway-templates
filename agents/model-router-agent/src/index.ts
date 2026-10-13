import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { Output, generateText, streamText } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  baseURL: process.env.LLMGATEWAY_GATEWAY_URL
    ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
    : undefined,
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const ROUTER_MODEL = process.env.ROUTER_MODEL || "gpt-6-luna";

const TIERS = {
  simple: process.env.SIMPLE_MODEL || "gpt-6-luna",
  standard: process.env.STANDARD_MODEL || "claude-sonnet-5-5",
  complex: process.env.COMPLEX_MODEL || "gpt-6.1-sol",
} as const;

type Tier = keyof typeof TIERS;

const routeSchema = z.object({
  tier: z
    .enum(["simple", "standard", "complex"])
    .describe(
      "simple = lookup, rewrite, short answer. standard = writing, coding, analysis. complex = multi-step reasoning, math proofs, architecture, long plans",
    ),
  reason: z.string().describe("One short sentence explaining the choice"),
});

type GatewayMetadata = { llmgateway?: { usage?: { cost?: number } } };

function costOf(metadata: unknown): number {
  return (
    (metadata as GatewayMetadata | undefined)?.llmgateway?.usage?.cost ?? 0
  );
}

async function route(prompt: string) {
  const result = await generateText({
    model: llmgateway(ROUTER_MODEL, { usage: { include: true } }),
    output: Output.object({ schema: routeSchema }),
    instructions:
      "You route user requests to the cheapest model tier that can answer them well. Pick the lowest tier that will not hurt answer quality.",
    prompt,
  });
  return { ...result.output, cost: costOf(result.finalStep.providerMetadata) };
}

async function answer(prompt: string, tier: Tier) {
  const started = performance.now();
  let firstTokenMs: number | undefined;
  const result = streamText({
    model: llmgateway(TIERS[tier], { usage: { include: true } }),
    prompt,
  });
  for await (const chunk of result.textStream) {
    firstTokenMs ??= performance.now() - started;
    process.stdout.write(chunk);
  }
  const finalStep = await result.finalStep;
  const usage = await result.usage;
  return {
    firstTokenMs: firstTokenMs ?? 0,
    totalMs: performance.now() - started,
    tokens: usage.totalTokens ?? 0,
    cost: costOf(finalStep.providerMetadata),
  };
}

const usd = (value: number) => `$${value.toFixed(6)}`;

const DEMO_PROMPTS = [
  "What is the capital of Australia?",
  "Write a TypeScript function that debounces another function, with types.",
  "Design a sharding strategy for a multi-tenant Postgres database with 50k tenants where 1% of tenants produce 80% of writes. Compare at least three options.",
];

async function main() {
  const input = process.argv.slice(2).join(" ").trim();

  if (input === "--help") {
    console.log("Model Router Agent - Powered by LLM Gateway\n");
    console.log("Usage: pnpm start [prompt]\n");
    console.log("Routes each prompt to the cheapest capable model tier:");
    for (const [tier, model] of Object.entries(TIERS)) {
      console.log(`  ${tier.padEnd(9)} → ${model}`);
    }
    return;
  }

  const prompts = input ? [input] : DEMO_PROMPTS;

  console.log("Model Router Agent - Powered by LLM Gateway\n");

  for (const prompt of prompts) {
    console.log("=".repeat(60));
    console.log(`Prompt: ${prompt}`);
    const decision = await route(prompt);
    const model = TIERS[decision.tier];
    console.log(`Route:  ${decision.tier} → ${model} (${decision.reason})`);
    console.log("-".repeat(60));
    const stats = await answer(prompt, decision.tier);
    console.log("\n" + "-".repeat(60));
    console.log(
      `First token ${Math.round(stats.firstTokenMs)}ms · total ${Math.round(stats.totalMs)}ms · ${stats.tokens} tokens · answer ${usd(stats.cost)} + routing ${usd(decision.cost)}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
