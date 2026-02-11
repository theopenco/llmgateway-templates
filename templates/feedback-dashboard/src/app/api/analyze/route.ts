import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const analysisSchema = z.object({
  overallSentiment: z
    .enum(["positive", "negative", "neutral", "mixed"])
    .describe("The overall sentiment across all reviews"),
  averageScore: z
    .number()
    .min(0)
    .max(10)
    .describe("Average sentiment score from 0 (most negative) to 10 (most positive)"),
  summary: z
    .string()
    .describe("A 2-3 sentence summary of the overall feedback"),
  themes: z
    .array(
      z.object({
        name: z.string().describe("Theme name (e.g. 'Customer Support', 'Pricing')"),
        count: z.number().describe("How many reviews mention this theme"),
        sentiment: z
          .enum(["positive", "negative", "neutral", "mixed"])
          .describe("Sentiment for this theme"),
      })
    )
    .describe("Key themes found across reviews"),
  reviews: z
    .array(
      z.object({
        text: z.string().describe("The original review text"),
        sentiment: z
          .enum(["positive", "negative", "neutral"])
          .describe("Sentiment of this review"),
        score: z.number().min(0).max(10).describe("Sentiment score 0-10"),
        keyPhrase: z.string().describe("The key phrase or takeaway from this review"),
      })
    )
    .describe("Individual review analysis"),
});

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

    const llmgateway = createLLMGateway({ apiKey });

    const { reviews } = await request.json();

    if (!reviews || typeof reviews !== "string" || !reviews.trim()) {
      return Response.json(
        { error: "Reviews text is required" },
        { status: 400 }
      );
    }

    const reviewList = reviews
      .split("\n")
      .map((r: string) => r.trim())
      .filter(Boolean);

    if (reviewList.length === 0) {
      return Response.json(
        { error: "At least one review is required" },
        { status: 400 }
      );
    }

    const result = await generateObject({
      model: llmgateway("openai/gpt-4o-mini"),
      schema: analysisSchema,
      prompt: `Analyze the following customer reviews and provide structured sentiment analysis.

Reviews:
${reviewList.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}

Analyze each review individually and provide an overall summary with key themes.`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Analysis error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze reviews",
      },
      { status: 500 }
    );
  }
}
