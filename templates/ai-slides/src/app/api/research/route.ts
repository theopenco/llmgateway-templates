import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText } from "ai";

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const llmgateway = createLLMGateway({ apiKey });
  const { topic, model } = await request.json();

  const result = await generateText({
    model: llmgateway(model || "perplexity/sonar-pro"),
    system: `You are a research assistant. Provide accurate, up-to-date information with specific facts, statistics, and data points that can be used in a presentation.

Format your response as structured research notes:
- Include key statistics and numbers
- Provide recent trends and developments
- List notable examples or case studies
- Include source attributions where possible
- Organize information by subtopic`,
    prompt: `Research the following topic thoroughly for a presentation: ${topic}`,
  });

  return Response.json({ research: result.text });
}
