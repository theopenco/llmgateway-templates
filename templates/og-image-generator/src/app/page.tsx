"use client";

import { useState } from "react";
import { Copy, Download, KeyRound, Loader2, Sparkles } from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("gradient");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { apiKey, setOpen: setApiKeyOpen } = useApiKey();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ productName, description, style }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate");
      }

      const data = await response.json();
      setImage(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload() {
    if (!image) return;
    const response = await fetch(image);
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "og-image.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleCopyDataUrl() {
    if (!image) return;
    navigator.clipboard.writeText(image);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
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
          <h1 className="mb-2 text-4xl font-bold">OG Image Generator</h1>
          <p className="text-lg text-muted-foreground">
            Generate Open Graph images with AI via LLM Gateway
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Configure</CardTitle>
              <CardDescription>
                Describe your product and the AI will generate an OG image
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
                <CardDescription>AI-generated Open Graph image</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex aspect-[1200/630] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-[#171717]">
                  {image ? (
                    <img
                      src={image}
                      alt="Generated OG image"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your preview will appear here
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {image && (
              <div className="flex gap-3">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="size-4" />
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyDataUrl}
                  className="flex-1"
                >
                  <Copy className="size-4" />
                  {copied ? "Copied!" : "Copy Data URL"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
