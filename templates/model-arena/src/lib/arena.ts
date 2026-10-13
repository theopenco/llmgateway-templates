import type { UIMessage } from "ai";

export type RunMetrics = {
  model: string;
  firstTokenMs: number | null;
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
  tokensPerSecond: number | null;
  costUsd: number | null;
};

export type ArenaMessage = UIMessage<RunMetrics>;
