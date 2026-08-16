"use client";

import { useState } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { ModelPicker } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import type { Model } from "@/lib/models";

type GeneratedImage = {
  url: string;
  prompt: string;
};

export function ImageGenerator({
  models,
  defaultModel,
}: {
  models: Model[];
  defaultModel: string;
}) {
  const [model, setModel] = useState(defaultModel);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const { apiKey, setOpen: setApiKeyOpen } = useApiKey();

  async function handleSubmit(message: PromptInputMessage) {
    const prompt = message.text;
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ prompt, model }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate image");
      }

      const data = await response.json();

      if (data.images && data.images.length > 0) {
        setImages((prev) => [
          ...data.images.map((url: string) => ({ url, prompt })),
          ...prev,
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
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
          <h1 className="mb-2 text-4xl font-bold">Image Generation</h1>
          <p className="text-lg text-muted-foreground">
            Generate images using AI models via LLM Gateway
          </p>
        </header>

        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputTextarea
                placeholder="Describe the image you want to generate..."
                disabled={isLoading}
              />
              <PromptInputFooter>
                <PromptInputTools>
                  <ModelPicker
                    models={models}
                    value={model}
                    onChange={setModel}
                    size="sm"
                    className="w-[220px]"
                  />
                </PromptInputTools>
                <PromptInputSubmit
                  disabled={isLoading}
                  status={isLoading ? "submitted" : "ready"}
                />
              </PromptInputFooter>
            </PromptInput>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {images.length > 0 && (
          <section
            className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6"
            aria-label="Generated images"
          >
            {images.map((image, index) => (
              <Card
                key={`${image.prompt}-${index}`}
                className="overflow-hidden border-border bg-card"
              >
                <img
                  src={image.url}
                  alt={image.prompt}
                  className="aspect-square w-full object-cover"
                  width={512}
                  height={512}
                />
                <CardContent className="border-t border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    {image.prompt}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
