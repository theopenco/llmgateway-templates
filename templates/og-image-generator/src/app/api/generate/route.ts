import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateImage } from "ai";

export async function POST(request: Request) {
  try {
    const apiKey =
      request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

    const llmgateway = createLLMGateway({ apiKey });

    const { productName, description, style, model } = await request.json();

    if (!productName || typeof productName !== "string") {
      return Response.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const styleDescriptions: Record<string, string> = {
      gradient: "a vibrant gradient background with modern typography",
      minimal: "a clean, minimalist white background with elegant typography",
      bold: "a bold, high-contrast design with strong colors",
    };

    const styleDesc = styleDescriptions[style] || styleDescriptions.gradient;

    const result = await generateImage({
      model: llmgateway.image(model || "gemini-3-pro-image-preview"),
      prompt: `Create a professional Open Graph social media preview image in landscape orientation (wider than tall, roughly 1200x630 aspect ratio) for a product called "${productName}".${description ? ` The product: ${description}.` : ""} The design should feature ${styleDesc}. Include the product name "${productName}" as prominent heading text on the image. Make it look polished and suitable for social media sharing.`,
      n: 1,
    });

    const image = result.images[0];
    const dataUrl = `data:${image.mediaType || "image/png"};base64,${image.base64}`;

    return Response.json({ image: dataUrl });
  } catch (error) {
    console.error("OG generation error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate OG image",
      },
      { status: 500 }
    );
  }
}
