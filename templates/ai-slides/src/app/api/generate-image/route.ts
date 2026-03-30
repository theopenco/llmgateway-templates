import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateImage } from "ai";

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const llmgateway = createLLMGateway({ apiKey });
  const { prompt, model } = await request.json();

  const result = await generateImage({
    model: llmgateway.image(model || "gemini-3-pro-image-preview"),
    prompt: `Professional presentation slide image: ${prompt}. Clean, modern, minimal style suitable for a business presentation. No text overlays.`,
    n: 1,
  });

  const image = result.images[0];
  if (!image) {
    return Response.json({ error: "No image generated" }, { status: 500 });
  }

  return Response.json({
    image: `data:${image.mediaType};base64,${image.base64}`,
  });
}
