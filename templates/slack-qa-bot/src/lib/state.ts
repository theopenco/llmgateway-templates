import { createRedisState } from "@chat-adapter/state-redis";

/**
 * Redis-backed state adapter. Stores thread subscriptions (so the bot keeps
 * answering follow-up messages after the first mention) and distributed locks
 * (so two serverless instances never process the same webhook twice).
 *
 * Reads `REDIS_URL` from the environment automatically.
 */
export const state = createRedisState();
