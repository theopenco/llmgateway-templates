"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { Streamdown } from "streamdown";
import { Coins, Gauge, Loader2, Timer, Trophy, X, Zap } from "lucide-react";
import { ModelPicker } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import type { ArenaMessage, RunMetrics } from "@/lib/arena";
import type { Model } from "@/lib/models";
import { cn } from "@/lib/utils";

export type Run = { id: number; prompt: string };

export type Badge = "fastest" | "first-token" | "cheapest";

const BADGE_LABEL: Record<Badge, string> = {
  fastest: "Fastest",
  "first-token": "Quickest start",
  cheapest: "Cheapest",
};

function formatMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatCost(usd: number | null | undefined) {
  if (usd == null) return "—";
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(3)}`;
}

export function Lane({
  laneId,
  models,
  model,
  run,
  apiKey,
  badges,
  canRemove,
  onModelChange,
  onRemove,
  onSettled,
  onReset,
}: {
  laneId: string;
  models: Model[];
  model: string;
  run: Run | null;
  apiKey: string | null;
  badges: Badge[];
  canRemove: boolean;
  onModelChange: (model: string) => void;
  onRemove: () => void;
  onSettled: (laneId: string, metrics: RunMetrics | null) => void;
  onReset: (laneId: string) => void;
}) {
  const transport = useMemo(
    () => new DefaultChatTransport<ArenaMessage>({ api: "/api/arena" }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error, stop } =
    useChat<ArenaMessage>({ id: laneId, transport });
  const handledRun = useRef<number | null>(null);

  useEffect(() => {
    if (!run || handledRun.current === run.id) return;
    handledRun.current = run.id;
    onReset(laneId);
    const { prompt } = run;
    void (async () => {
      await stop();
      setMessages([]);
      await sendMessage(
        { text: prompt },
        {
          body: { model },
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
        },
      );
    })();
  }, [run, model, apiKey, laneId, sendMessage, setMessages, stop, onReset]);

  const answer = messages.findLast((message) => message.role === "assistant");
  const metrics = answer?.metadata;

  useEffect(() => {
    if (status === "ready" && metrics) onSettled(laneId, metrics);
    if (status === "error") onSettled(laneId, null);
  }, [status, metrics, laneId, onSettled]);

  const text = answer?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const busy = status === "submitted" || status === "streaming";

  return (
    <section
      className={cn(
        "@container flex h-[min(75vh,760px)] min-h-[420px] flex-col rounded-xl border bg-card transition-colors",
        badges.length > 0 ? "border-emerald-500/50" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 border-b border-border p-3">
        <ModelPicker
          models={models}
          value={model}
          onChange={onModelChange}
          className="min-w-0 flex-1"
        />
        {canRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            title="Remove model"
            disabled={busy}
          >
            <X className="size-4" />
          </Button>
        )}
      </header>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
            >
              <Trophy className="size-3" />
              {BADGE_LABEL[badge]}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
        {error ? (
          <p role="alert" className="text-destructive-foreground">
            {error.message ||
              "The request failed. Check your API key and model."}
          </p>
        ) : text ? (
          <Streamdown
            plugins={{ code, math }}
            shikiTheme={["github-dark", "github-dark"]}
            isAnimating={status === "streaming"}
            className="space-y-3 break-words"
          >
            {text}
          </Streamdown>
        ) : busy ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Waiting for first token…
          </div>
        ) : (
          <p className="text-muted-foreground">
            Responses appear here side by side.
          </p>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border p-3 text-xs text-muted-foreground @md:grid-cols-4">
        <Stat
          icon={Zap}
          label="First token"
          value={formatMs(metrics?.firstTokenMs)}
        />
        <Stat
          icon={Timer}
          label="Total"
          value={busy ? "…" : formatMs(metrics?.totalMs)}
        />
        <Stat
          icon={Gauge}
          label="Speed"
          value={
            metrics?.tokensPerSecond
              ? `${Math.round(metrics.tokensPerSecond)} tok/s`
              : "—"
          }
        />
        <Stat icon={Coins} label="Cost" value={formatCost(metrics?.costUsd)} />
      </footer>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}
