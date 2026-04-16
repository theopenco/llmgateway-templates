const GATEWAY_BASE = "https://api.llmgateway.io/v1";

export async function GET(request: Request) {
  const apiKey =
    request.headers.get("x-api-key") ||
    new URL(request.url).searchParams.get("apiKey") ||
    process.env.LLMGATEWAY_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 401 });
  }

  const response = await fetch(`${GATEWAY_BASE}/models?limit=500`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return Response.json(
      { error: "Failed to fetch models" },
      { status: response.status }
    );
  }

  const data = await response.json();
  return Response.json(data);
}
