"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Maximize2,
  Minimize2,
  Pen,
  SpellCheck,
  Volume2,
} from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ACTIONS = [
  { id: "rewrite", label: "Rewrite", icon: Pen },
  { id: "summarize", label: "Summarize", icon: Minimize2 },
  { id: "expand", label: "Expand", icon: Maximize2 },
  { id: "fix-grammar", label: "Fix Grammar", icon: SpellCheck },
  { id: "change-tone", label: "Change Tone", icon: Volume2 },
];

const TONES = [
  "professional",
  "casual",
  "formal",
  "friendly",
  "persuasive",
  "academic",
];

export default function Home() {
  const [text, setText] = useState("");
  const [action, setAction] = useState<string | null>(null);
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { apiKey, setOpen: setApiKeyOpen } = useApiKey();

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  async function handleAction(selectedAction: string) {
    if (!text.trim() || isLoading) return;

    setAction(selectedAction);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          text,
          action: selectedAction,
          tone: selectedAction === "change-tone" ? tone : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process");
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function handleApply() {
    if (result) {
      setText(result);
      setResult(null);
      setAction(null);
    }
  }

  function handleCopy() {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setApiKeyOpen(true)}
              title="API Key"
            >
              <KeyRound className="size-4" />
            </Button>
          </div>
          <h1 className="mb-2 text-4xl font-bold">Writing Assistant</h1>
          <p className="text-lg text-muted-foreground">
            Transform your text with AI-powered writing tools
          </p>
        </header>

        <div className="space-y-4">
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type your text here..."
              rows={8}
              className="w-full resize-none rounded-lg border border-input bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            <div className="mt-1 flex justify-end gap-3 text-xs text-muted-foreground">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.id}
                  variant={action === a.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleAction(a.id)}
                  disabled={isLoading || !text.trim()}
                >
                  {isLoading && action === a.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                  {a.label}
                </Button>
              );
            })}
            {(action === "change-tone" || !action) && (
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="rounded-md border border-input bg-secondary px-2 py-1.5 text-sm outline-none"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive-foreground">{error}</p>
          )}

          {result && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Result</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" onClick={handleApply}>
                    <ArrowRightLeft className="size-4" />
                    Apply
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {result}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
