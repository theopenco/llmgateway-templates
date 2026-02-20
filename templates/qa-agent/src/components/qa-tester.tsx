"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  Play,
  Square,
  KeyRound,
  Loader2,
  CheckCircle2,
  Globe,
  AlertCircle,
  CheckIcon,
  ChevronsUpDown,
} from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { Button } from "@/components/ui/button";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/model-selector";

export type Model = {
  id: string;
  name: string;
  family: string;
  providers: string[];
};

const FAMILY_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
  deepseek: "DeepSeek",
  mistral: "Mistral",
};

const TOOL_INFO: Record<string, { label: string; badge: string }> = {
  browser_navigate: { label: "Navigate", badge: "navigate" },
  browser_click: { label: "Click", badge: "click" },
  browser_type: { label: "Type", badge: "type" },
  browser_snapshot: { label: "Snapshot", badge: "snapshot" },
  browser_take_screenshot: { label: "Screenshot", badge: "screenshot" },
  browser_hover: { label: "Hover", badge: "hover" },
  browser_select_option: { label: "Select", badge: "select" },
  browser_press_key: { label: "Press key", badge: "key" },
  browser_scroll: { label: "Scroll", badge: "scroll" },
  browser_go_back: { label: "Go back", badge: "navigate" },
  browser_go_forward: { label: "Go forward", badge: "navigate" },
};

function getToolInfo(toolName: string) {
  return (
    TOOL_INFO[toolName] || {
      label: toolName.replace(/^browser_/, "").replace(/_/g, " "),
      badge: "action",
    }
  );
}

function formatArgs(
  toolName: string,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case "browser_navigate":
      return String(args.url || "");
    case "browser_type":
      return `"${String(args.text || args.value || "")}"`;
    case "browser_click":
      return args.ref ? `ref: ${args.ref}` : "";
    case "browser_press_key":
      return String(args.key || "");
    case "browser_select_option":
      return [args.ref ? `ref: ${args.ref}` : "", String(args.value || "")]
        .filter(Boolean)
        .join(" → ");
    default:
      if (args.ref) return `ref: ${args.ref}`;
      if (args.url) return String(args.url);
      return "";
  }
}

type ActionEvent = {
  type: "action";
  step: number;
  tool: string;
  args: Record<string, unknown>;
  status: "done";
};

type StatusEvent = {
  type: "status";
  message: string;
};

type TextEvent = {
  type: "text";
  content: string;
};

type TimelineEvent = ActionEvent | StatusEvent | TextEvent;

interface ModelItemProps {
  model: Model;
  selectedModel: string;
  onSelect: (id: string) => void;
}

const ModelItem = memo(({ model, selectedModel, onSelect }: ModelItemProps) => {
  const handleSelect = useCallback(
    () => onSelect(model.id),
    [onSelect, model.id]
  );
  return (
    <ModelSelectorItem onSelect={handleSelect} value={model.id}>
      <ModelSelectorLogo provider={model.family} />
      <ModelSelectorName>{model.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {model.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {selectedModel === model.id ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  );
});

ModelItem.displayName = "ModelItem";

export function QATester({ models }: { models: Model[] }) {
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("http://localhost:3000");
  const [instruction, setInstruction] = useState("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestFrame, setLatestFrame] = useState<string | null>(null);
  const { apiKey, setOpen: setApiKeyOpen } = useApiKey();
  const abortRef = useRef<AbortController | null>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === model);

  // Get unique families in order of appearance
  const families = [...new Set(models.map((m) => m.family))];

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline, summary, error]);

  const handleModelSelect = useCallback((id: string) => {
    setModel(id);
    setModelSelectorOpen(false);
  }, []);

  const handleRun = useCallback(async () => {
    if (!instruction.trim() || isRunning) return;

    setIsRunning(true);
    setTimeline([]);
    setSummary(null);
    setError(null);
    setLatestFrame(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["x-api-key"] = apiKey;

      const response = await fetch("/api/test", {
        method: "POST",
        headers,
        body: JSON.stringify({ instruction, model, targetUrl }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as
              | TimelineEvent
              | { type: "screenshot"; imageData: string }
              | { type: "result"; summary: string }
              | { type: "error"; message: string };
            if (event.type === "screenshot") {
              setLatestFrame(`data:image/jpeg;base64,${event.imageData}`);
            } else if (event.type === "result") {
              setSummary(event.summary);
            } else if (event.type === "error") {
              setError(event.message);
            } else {
              setTimeline((prev) => [...prev, event]);
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setTimeline((prev) => [
          ...prev,
          { type: "status", message: "Test stopped by user" },
        ]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [instruction, model, targetUrl, apiKey, isRunning]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <main className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">AI QA Tester</h1>
        <div className="flex items-center gap-3">
          <ModelSelector
            open={modelSelectorOpen}
            onOpenChange={setModelSelectorOpen}
          >
            <ModelSelectorTrigger asChild>
              <Button
                variant="outline"
                className="w-[220px] justify-between"
              >
                {selectedModel && (
                  <>
                    <ModelSelectorLogo provider={selectedModel.family} />
                    <ModelSelectorName>
                      {selectedModel.name}
                    </ModelSelectorName>
                  </>
                )}
                <ChevronsUpDown className="size-3.5 opacity-50" />
              </Button>
            </ModelSelectorTrigger>
            <ModelSelectorContent>
              <ModelSelectorInput placeholder="Search models..." />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                {families.map((family) => (
                  <ModelSelectorGroup
                    heading={FAMILY_LABELS[family] ?? family}
                    key={family}
                  >
                    {models
                      .filter((m) => m.family === family)
                      .map((m) => (
                        <ModelItem
                          key={m.id}
                          model={m}
                          onSelect={handleModelSelect}
                          selectedModel={model}
                        />
                      ))}
                  </ModelSelectorGroup>
                ))}
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="http://localhost:3000"
            className="w-64 rounded-md border border-input bg-secondary px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setApiKeyOpen(true)}
            title="API Key"
          >
            <KeyRound className="size-4" />
          </Button>
        </div>
      </header>

      {/* Instruction Input */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Test Instructions
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., Test the signup flow and verify a confirmation message appears"
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleRun();
                }
              }}
            />
          </div>
          <div className="flex gap-2 pt-7">
            {isRunning ? (
              <Button variant="destructive" onClick={handleStop}>
                <Square className="size-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={handleRun} disabled={!instruction.trim()}>
                <Play className="size-4" />
                Run
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Split Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Action Timeline */}
        <div className="flex w-[40%] flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-medium">Agent Actions</span>
            {isRunning && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {timeline.length === 0 && !isRunning && !summary && !error && (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <Globe className="mx-auto mb-3 size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Enter test instructions and click Run to start
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {timeline.map((event, i) => {
                if (event.type === "status") {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground italic"
                    >
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                      {event.message}
                    </div>
                  );
                }

                if (event.type === "text") {
                  return (
                    <div
                      key={i}
                      className="rounded-md bg-secondary/50 px-3 py-2 text-sm"
                    >
                      {event.content}
                    </div>
                  );
                }

                if (event.type === "action") {
                  const info = getToolInfo(event.tool);
                  const argsStr = formatArgs(event.tool, event.args);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-secondary/30"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                        {event.step}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {info.label}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                            {info.badge}
                          </span>
                        </div>
                        {argsStr && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {argsStr}
                          </p>
                        )}
                      </div>
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    </div>
                  );
                }

                return null;
              })}

              {isRunning && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Processing...
                </div>
              )}

              <div ref={timelineEndRef} />
            </div>

            {summary && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h3 className="mb-2 text-sm font-medium text-emerald-400">
                  Test Complete
                </h3>
                <p className="whitespace-pre-wrap text-sm">{summary}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-destructive-foreground" />
                  <h3 className="text-sm font-medium text-destructive-foreground">
                    Error
                  </h3>
                </div>
                <p className="mt-1 text-sm text-destructive-foreground/80">
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center border-b border-border px-4 py-2">
            <span className="text-sm font-medium">Preview</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {targetUrl}
            </span>
            {isRunning && latestFrame && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </div>
          <div className="relative flex-1 overflow-hidden bg-neutral-900">
            {latestFrame ? (
              <img
                src={latestFrame}
                alt="Browser preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <Globe className="mx-auto mb-3 size-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {isRunning
                      ? "Connecting to browser stream..."
                      : "Live preview will appear when the test starts"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
