import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const ogSchema = z.object({
  title: z.string().describe("A compelling title for the OG image (max 60 chars)"),
  subtitle: z
    .string()
    .describe("A supporting subtitle or tagline (max 100 chars)"),
  callToAction: z.string().describe("A short call-to-action text (max 30 chars)"),
  theme: z
    .enum(["gradient", "minimal", "bold"])
    .describe("Visual theme for the OG image"),
  gradientFrom: z
    .string()
    .describe("Starting hex color for gradient background (e.g. #6366f1)"),
  gradientTo: z
    .string()
    .describe("Ending hex color for gradient background (e.g. #8b5cf6)"),
});

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

    const llmgateway = createLLMGateway({ apiKey });

    const { productName, description, style } = await request.json();

    if (!productName || typeof productName !== "string") {
      return Response.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const result = await generateObject({
      model: llmgateway("openai/gpt-4o-mini"),
      schema: ogSchema,
      prompt: `Generate compelling OG image copy for a product/page.

Product name: ${productName}
Description: ${description || "N/A"}
Preferred style: ${style || "gradient"}

Create a title, subtitle, and call-to-action that would look great on a 1200x630 Open Graph image. Choose colors that match the product's vibe. The theme should be "${style || "gradient"}".`,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("OG generation error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate OG copy",
      },
      { status: 500 }
    );
  }
}
