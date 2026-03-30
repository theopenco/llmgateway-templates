import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const presentationSchema = z.object({
  title: z.string().describe("A compelling presentation title"),
  slides: z.array(
    z.object({
      layout: z
        .enum([
          "title",
          "content",
          "image-left",
          "image-right",
          "two-column",
          "blank",
        ])
        .describe("The layout type for this slide"),
      title: z.string().describe("The slide title"),
      subtitle: z
        .string()
        .describe("Subtitle text, or empty string if not needed"),
      content: z
        .string()
        .describe(
          "The main content. Use bullet points separated by newlines for list items. Prefix each bullet with '- '."
        ),
      secondaryContent: z
        .string()
        .describe(
          "Secondary content for two-column layout, or empty string if not applicable"
        ),
      speakerNotes: z
        .string()
        .describe("Speaker notes for the presenter"),
    })
  ),
});

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const llmgateway = createLLMGateway({ apiKey });
  const { prompt, model, slideCount } = await request.json();

  const result = await generateObject({
    model: llmgateway(model || "gpt-4o-mini"),
    schema: presentationSchema,
    system: `You are an expert presentation designer. Create professional, engaging presentations.

Guidelines:
- Start with a "title" layout slide as the first slide
- Use a mix of layouts to keep the presentation visually interesting
- Content should be concise - use bullet points (prefix with "- ") for lists
- Each bullet point should be a complete, clear thought
- Include speaker notes to help the presenter
- For "two-column" layouts, provide secondaryContent
- End with a summary or call-to-action slide
- Aim for ${slideCount || 8} slides total
- For fields that don't apply (e.g. subtitle on a content slide), use empty string`,
    prompt: `Create a presentation about: ${prompt}`,
  });

  return Response.json(result.object);
}
