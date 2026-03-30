"use client";

import { useEffect, useState } from "react";

export type Model = {
  id: string;
  name: string;
  family: string;
};

type ModelLists = {
  textModels: Model[];
  imageModels: Model[];
  searchModels: Model[];
  isLoading: boolean;
};

export function useModels(apiKey: string | null): ModelLists {
  const [textModels, setTextModels] = useState<Model[]>([]);
  const [imageModels, setImageModels] = useState<Model[]>([]);
  const [searchModels, setSearchModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchModels() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/models", {
          headers: { "x-api-key": apiKey! },
        });

        if (!response.ok) return;

        const data = await response.json();
        const rawModels = data.data || [];

        if (cancelled) return;

        const text: Model[] = [];
        const image: Model[] = [];
        const search: Model[] = [];

        for (const m of rawModels) {
          const id = m.id as string;
          const name = (m.name as string) || id;
          const family = (m.family as string) || "";
          const outputModalities: string[] =
            m.architecture?.output_modalities || [];
          const isImageModel = outputModalities.includes("image");
          const isTextOnly =
            outputModalities.includes("text") && !isImageModel;

          if (id === "custom" || id === "auto") continue;

          const model = { id, name, family };

          if (isImageModel) {
            image.push(model);
          }

          // Text models: either text-only output, or no architecture info (legacy)
          if (isTextOnly || outputModalities.length === 0) {
            text.push(model);
          }

          if (
            id.includes("sonar") ||
            id.includes("search") ||
            id.includes("perplexity")
          ) {
            search.push(model);
          }
        }

        setTextModels(text);
        setImageModels(image);
        setSearchModels(search);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return { textModels, imageModels, searchModels, isLoading };
}
