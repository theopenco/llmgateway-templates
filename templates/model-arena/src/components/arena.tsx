"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Play, Plus, Swords } from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { Lane, type Badge, type Run } from "@/components/lane";
import { PoweredBy } from "@/components/powered-by";
import { Button } from "@/components/ui/button";
import type { RunMetrics } from "@/lib/arena";
import type { Model } from "@/lib/models";

const MAX_LANES = 4;

const SUGGESTIONS = [
  "Explain quantum entanglement to a 10 year old in 3 sentences.",
  "Write a regex that validates an IPv4 address and explain it.",
  "A bat and a ball cost $1.10. The bat costs $1 more than the ball. How much is the ball?",
  "Draft a polite email declining a meeting invite.",
];

type LaneState = { id: string; model: string };

let laneCounter = 0;
const newLane = (model: string): LaneState => ({
  id: `lane-${++laneCounter}`,
  model,
});

function pickWinner(
  entries: [string, RunMetrics][],
  value: (m: RunMetrics) => number | null,
) {
  let best: { id: string; value: number } | null = null;
  for (const [id, metrics] of entries) {
    const v = value(metrics);
    if (v == null) continue;
    if (!best || v < best.value) best = { id, value: v };
  }
  return best?.id;
}

export function Arena({
  models,
  defaultModels,
}: {
  models: Model[];
  defaultModels: string[];
}) {
  const { apiKey, setOpen: setApiKeyOpen } = useApiKey();
  const [lanes, setLanes] = useState(() => defaultModels.map(newLane));
  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [results, setResults] = useState<Record<string, RunMetrics | null>>({});

  const onSettled = useCallback(
    (laneId: string, metrics: RunMetrics | null) =>
      setResults((current) =>
        laneId in current && current[laneId] === metrics
          ? current
          : { ...current, [laneId]: metrics },
      ),
    [],
  );

  const onReset = useCallback(
    (laneId: string) =>
      setResults((current) => {
        if (!(laneId in current)) return current;
        const next = { ...current };
        delete next[laneId];
        return next;
      }),
    [],
  );

  const finished = lanes.every((lane) => lane.id in results);

  const badges = useMemo(() => {
    const map: Record<string, Badge[]> = {};
    if (!finished) return map;
    const entries = Object.entries(results).filter(
      (entry): entry is [string, RunMetrics] => entry[1] !== null,
    );
    if (entries.length < 2) return map;
    const add = (id: string | undefined, badge: Badge) => {
      if (id) (map[id] ??= []).push(badge);
    };
    add(
      pickWinner(entries, (m) => m.totalMs),
      "fastest",
    );
    add(
      pickWinner(entries, (m) => m.firstTokenMs),
      "first-token",
    );
    add(
      pickWinner(entries, (m) => m.costUsd),
      "cheapest",
    );
    return map;
  }, [results, finished]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setResults({});
    setRun({ id: Date.now(), prompt: text });
  };

  const totalCost = Object.values(results).reduce(
    (sum, m) => sum + (m?.costUsd ?? 0),
    0,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
            <Swords className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Model Arena</h1>
            <p className="text-sm text-muted-foreground">
              One prompt, several models, live speed and cost.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setApiKeyOpen(true)}
          title="API Key"
        >
          <KeyRound className="size-4" />
        </Button>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
              submit();
          }}
          rows={3}
          placeholder="Ask something and compare the answers…"
          className="w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setPrompt(suggestion)}
              className="max-w-[280px] truncate rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={lanes.length >= MAX_LANES}
              onClick={() =>
                setLanes((current) => [
                  ...current,
                  newLane(
                    models.find((m) => !current.some((l) => l.model === m.id))
                      ?.id ?? current[0].model,
                  ),
                ])
              }
            >
              <Plus className="size-4" />
              Add model
            </Button>
            <Button type="submit" disabled={!prompt.trim()}>
              <Play className="size-4" />
              Run
              <kbd className="ml-1 hidden rounded bg-black/10 px-1 text-[10px] sm:inline">
                ⌘↵
              </kbd>
            </Button>
          </div>
        </div>
      </form>

      <div
        className="grid flex-1 gap-4"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 320px), 1fr))`,
        }}
      >
        {lanes.map((lane) => (
          <Lane
            key={lane.id}
            laneId={lane.id}
            models={models}
            model={lane.model}
            run={run}
            apiKey={apiKey}
            badges={badges[lane.id] ?? []}
            canRemove={lanes.length > 1}
            onModelChange={(model) =>
              setLanes((current) =>
                current.map((l) => (l.id === lane.id ? { ...l, model } : l)),
              )
            }
            onRemove={() => {
              setLanes((current) => current.filter((l) => l.id !== lane.id));
              onReset(lane.id);
            }}
            onSettled={onSettled}
            onReset={onReset}
          />
        ))}
      </div>

      <footer className="flex flex-col items-center gap-2 pb-2 text-xs text-muted-foreground">
        {finished && Object.keys(results).length > 0 && (
          <span>
            Total cost of this run: ${totalCost.toFixed(5)} · billed through one
            LLM Gateway key
          </span>
        )}
        <PoweredBy />
      </footer>
    </main>
  );
}
