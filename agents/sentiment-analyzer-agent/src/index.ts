import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const sentimentSchema = z.object({
  sentiment: z
    .enum(["positive", "negative", "neutral", "mixed"])
    .describe("The overall sentiment of the text"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score between 0 and 1"),
  keyPhrases: z
    .array(z.string())
    .describe("Key phrases that influenced the sentiment analysis"),
  summary: z
    .string()
    .describe("A brief summary explaining the sentiment analysis"),
});

async function runSentimentAnalyzer(
  text: string
): Promise<z.infer<typeof sentimentSchema>> {
  const result = await generateText({
    model: llmgateway("openai/gpt-4o-mini"),
    output: Output.object({ schema: sentimentSchema }),
    system: `You are a sentiment analysis expert. Analyze the given text and determine its sentiment.

Guidelines:
- Classify as positive, negative, neutral, or mixed
- Provide a confidence score (0-1) reflecting how clear the sentiment is
- Extract key phrases that most strongly indicate the sentiment
- Write a brief summary explaining your analysis
- Consider context, sarcasm, and nuance
- For mixed sentiment, explain the contrasting elements`,
    prompt: `Analyze the sentiment of the following text:\n\n${text}`,
  });

  return result.output;
}

function resolveInput(args: string[]): string {
  const input = args.join(" ");

  if (!input) {
    console.error(
      "Usage: node dist/index.js <text or file path>\n\nExamples:"
    );
    console.error('  node dist/index.js "I love this product, it works great!"');
    console.error("  node dist/index.js review.txt");
    process.exit(1);
  }

  // Check if the input looks like a file path
  if (
    (input.endsWith(".txt") || input.endsWith(".md")) &&
    existsSync(input)
  ) {
    return readFileSync(input, "utf-8");
  }

  return input;
}

async function main() {
  const args = process.argv.slice(2);
  const text = resolveInput(args);

  console.log("Sentiment Analyzer Agent - Powered by LLM Gateway\n");
  console.log("=".repeat(50));
  console.log(`\nInput: ${text.length > 100 ? text.slice(0, 100) + "..." : text}`);
  console.log("-".repeat(50));

  const analysis = await runSentimentAnalyzer(text);

  console.log(`\nSentiment:  ${analysis.sentiment}`);
  console.log(`Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
  console.log(`\nKey Phrases:`);
  for (const phrase of analysis.keyPhrases) {
    console.log(`  - ${phrase}`);
  }
  console.log(`\nSummary: ${analysis.summary}`);
  console.log("\n" + "=".repeat(50));
}

main().catch(console.error);
