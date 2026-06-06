import { LLMGateway } from "@llmgateway/server";

/**
 * Mints an ephemeral end-user session with your SECRET key, server-side.
 *
 * In a real app you'd identify the signed-in user here (from your auth/session)
 * and pass their stable id as `externalId` so the same wallet follows them. For
 * the demo we use a fixed id.
 */
export async function POST() {
  const secretKey = process.env.LLMGATEWAY_SECRET_KEY;
  if (!secretKey) {
    return Response.json(
      { error: "LLMGATEWAY_SECRET_KEY is not set" },
      { status: 500 },
    );
  }

  const lg = new LLMGateway({
    secretKey,
    apiBaseUrl: process.env.LLMGATEWAY_API_URL,
  });

  // TODO: replace with your authenticated user's id.
  const externalId = "demo-user";

  const session = await lg.sessions.create({
    customer: { externalId },
    scope: { models: ["openai/gpt-4o-mini"] },
    ttlSeconds: 900,
  });

  return Response.json(session);
}
