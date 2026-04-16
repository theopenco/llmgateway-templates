import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText } from "ai";
import { compileSpecStream } from "@json-render/core";

const CHART_SYSTEM_PROMPT = `You are a UI generator that outputs JSON.

OUTPUT FORMAT (JSONL, RFC 6902 JSON Patch):
Output JSONL (one JSON object per line) using RFC 6902 JSON Patch operations to build a UI tree.
Each line is a JSON patch operation. Start with /root, then /elements.

Example:
{"op":"add","path":"/root","value":"chart-1"}
{"op":"add","path":"/elements/chart-1","value":{"type":"BarChart","props":{"title":"Revenue","description":"Monthly revenue","data":[{"month":"Jan","revenue":4000},{"month":"Feb","revenue":3000}],"series":[{"dataKey":"revenue","label":"Revenue"}],"xAxisKey":"month"},"children":[]}}

AVAILABLE COMPONENTS:

BarChart - A bar chart for comparing categorical data
Props: { title?: string, description?: string, data: array of objects, series: array of {dataKey: string, label?: string, color?: string}, xAxisKey: string, layout?: "vertical"|"horizontal", stacked?: boolean }

LineChart - A line chart for showing trends over time
Props: { title?: string, description?: string, data: array of objects, series: array of {dataKey: string, label?: string, color?: string}, xAxisKey: string, curved?: boolean }

AreaChart - An area chart for showing volume trends
Props: { title?: string, description?: string, data: array of objects, series: array of {dataKey: string, label?: string, color?: string}, xAxisKey: string, stacked?: boolean }

PieChart - A pie chart for showing proportions
Props: { title?: string, description?: string, data: array of {label: string, value: number, fill?: string}, innerRadius?: number, showLabel?: boolean }

RULES:
- Generate a SINGLE chart element. Root should point to one chart element.
- Use the provided research data to populate the chart with REAL, accurate numbers.
- Use descriptive labels.
- Output ONLY the JSONL patch lines, nothing else. No markdown, no explanation.`;

export async function POST(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") || process.env.LLMGATEWAY_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const llmgateway = createLLMGateway({ apiKey });
  const { prompt, model, searchModel } = await request.json();

  // Step 1: Research real data using a search model
  const research = await generateText({
    model: llmgateway(searchModel || "sonar-pro"),
    system: `You are a data research assistant. Find real, accurate, up-to-date statistics and numerical data that can be used in a chart. Return concrete numbers, percentages, and data points. Be specific with values. Format as a clear data summary.`,
    prompt: `Find real data and statistics for this chart: ${prompt}`,
  });

  // Step 2: Generate chart spec using the researched data
  const result = await generateText({
    model: llmgateway(model || "gpt-4o-mini"),
    system: CHART_SYSTEM_PROMPT,
    prompt: `Create a chart based on this request: ${prompt}

Use this researched data to populate the chart with real numbers:
${research.text}`,
  });

  // Parse the JSONL output using json-render's compileSpecStream
  const text = result.text.replace(/```[\w]*\n?/g, "").trim();

  try {
    const spec = compileSpecStream(text);
    return Response.json(spec);
  } catch {
    try {
      const parsed = JSON.parse(text);
      return Response.json(parsed);
    } catch {
      return Response.json(
        { error: "Failed to parse chart spec" },
        { status: 500 }
      );
    }
  }
}
