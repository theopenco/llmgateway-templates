"use client";

import { useState } from "react";
import { Copy, Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OgData = {
  title: string;
  subtitle: string;
  callToAction: string;
  theme: string;
  gradientFrom: string;
  gradientTo: string;
};

export default function Home() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("gradient");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, description, style }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate");
      }

      const data = await response.json();
      setOgData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  function getOgUrl() {
    if (!ogData) return "";
    const params = new URLSearchParams({
      title: ogData.title,
      subtitle: ogData.subtitle,
      cta: ogData.callToAction,
      theme: ogData.theme,
      from: ogData.gradientFrom,
      to: ogData.gradientTo,
    });
    return `/api/og?${params.toString()}`;
  }

  async function handleDownload() {
    const url = getOgUrl();
    const response = await fetch(url);
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "og-image.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleCopyUrl() {
    const url = `${window.location.origin}${getOgUrl()}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const previewBg =
    ogData?.theme === "minimal"
      ? { background: "#ffffff", color: "#0a0a0a" }
      : ogData?.theme === "bold"
        ? { background: ogData.gradientFrom, color: "#ffffff" }
        : {
            background: `linear-gradient(135deg, ${ogData?.gradientFrom || "#6366f1"}, ${ogData?.gradientTo || "#8b5cf6"})`,
            color: "#ffffff",
          };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">OG Image Generator</h1>
          <p className="text-lg text-muted-foreground">
            Generate Open Graph images with AI-powered copy via LLM Gateway
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Configure</CardTitle>
              <CardDescription>
                Describe your product and the AI will generate OG image copy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Product Name
                  </label>
                  <input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. LLM Gateway"
                    className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does your product do?"
                    rows={3}
                    className="w-full resize-none rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Style
                  </label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none"
                  >
                    <option value="gradient">Gradient</option>
                    <option value="minimal">Minimal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !productName.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {isLoading ? "Generating..." : "Generate OG Image"}
                </Button>
              </form>
              {error && (
                <p className="mt-3 text-sm text-destructive-foreground">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>1200 x 630 — Open Graph image</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="flex aspect-[1200/630] w-full flex-col items-center justify-center rounded-lg border border-border p-8 text-center"
                  style={ogData ? previewBg : { background: "#171717" }}
                >
                  {ogData ? (
                    <>
                      <p className="mb-2 text-2xl font-bold lg:text-3xl">
                        {ogData.title}
                      </p>
                      <p className="mb-4 text-sm opacity-85 lg:text-base">
                        {ogData.subtitle}
                      </p>
                      <span
                        className="rounded-lg px-4 py-2 text-xs font-semibold lg:text-sm"
                        style={{
                          background:
                            ogData.theme === "minimal"
                              ? "#0a0a0a"
                              : "rgba(255,255,255,0.2)",
                          color: "#ffffff",
                        }}
                      >
                        {ogData.callToAction}
                      </span>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your preview will appear here
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {ogData && (
              <div className="flex gap-3">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="size-4" />
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="flex-1"
                >
                  <Copy className="size-4" />
                  {copied ? "Copied!" : "Copy URL"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
