import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateImage } from "ai";

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

    const llmgateway = createLLMGateway({ apiKey });

    const { prompt, model } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await generateImage({
      model: llmgateway.image(model || "gemini-3-pro-image-preview"),
      prompt,
      n: 1,
    });

    const images = result.images.map(
      (image) =>
        `data:${image.mediaType || "image/png"};base64,${image.base64}`
    );

    return Response.json({ images });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate image",
      },
      { status: 500 }
    );
  }
}
