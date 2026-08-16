import { MODELS_REVALIDATE_SECONDS, MODELS_URL } from "@/lib/models";

/**
 * Proxy for the gateway model catalog. The catalog itself is public, but
 * `/v1/models` sends no CORS headers, so the browser can't read it directly.
 */
export async function GET() {
  const response = await fetch(MODELS_URL, {
    next: { revalidate: MODELS_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return Response.json(
      { error: "Failed to fetch models" },
      { status: response.status },
    );
  }

  return Response.json(await response.json());
}
