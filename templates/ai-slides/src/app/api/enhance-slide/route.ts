import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const enhancedSlideSchema = z.object({
  title: z.string().describe("The improved slide title"),
  content: z
    .string()
    .describe("The improved content with bullet points prefixed by '- '"),
  subtitle: z
    .string()
    .describe("Improved subtitle, or empty string if not applicable"),
  speakerNotes: z
    .string()
    .describe("Improved speaker notes for the presenter"),
});

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const llmgateway = createLLMGateway({ apiKey });
  const { slide, instruction, model, researchContext } = await request.json();

  const contextSection = researchContext
    ? `\n\nResearch context to incorporate:\n${researchContext}`
    : "";

  const result = await generateObject({
    model: llmgateway(model || "gpt-4o-mini"),
    schema: enhancedSlideSchema,
    system: `You are a presentation content expert. Enhance slide content to be more engaging, clear, and professional.

Guidelines:
- Make titles concise and impactful
- Use clear, scannable bullet points (prefix with "- ")
- Keep content concise - presentations should be visual, not text-heavy
- Add speaker notes for the presenter
- Maintain the original intent while improving clarity
- If there is no subtitle, return an empty string for subtitle`,
    prompt: `Enhance this slide:
Title: ${slide.title}
Content: ${slide.content}
${slide.subtitle ? `Subtitle: ${slide.subtitle}` : ""}
${slide.speakerNotes ? `Speaker Notes: ${slide.speakerNotes}` : ""}

Instruction: ${instruction || "Make this slide more engaging and professional"}${contextSection}`,
  });

  return Response.json(result.object);
}
