import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText } from "ai";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { prompt, model } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await generateText({
      model: llmgateway(model || "google/gemini-2.0-flash-exp-image-generation"),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const images: string[] = [];

    for (const message of result.response.messages) {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === "file") {
            const filePart = part as {
              type: "file";
              data: string | Uint8Array | ArrayBuffer | URL;
              mediaType?: string;
            };

            if (filePart.mediaType?.startsWith("image/")) {
              if (typeof filePart.data === "string") {
                images.push(`data:${filePart.mediaType};base64,${filePart.data}`);
              }
            }
          }
        }
      }
    }

    return Response.json({ images });
  } catch (error) {
    console.error("Image generation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
}
