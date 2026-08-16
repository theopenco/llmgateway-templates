"use client";

import { useEffect, useState } from "react";

import { shapeModels, type CatalogEntry, type Model } from "@/lib/models";

export type { Model };

type ModelLists = {
  textModels: Model[];
  imageModels: Model[];
  searchModels: Model[];
  isLoading: boolean;
};

/**
 * Load the gateway model catalog (through the `/api/models` proxy, since
 * `/v1/models` sends no CORS headers) and split it into the three pickers this
 * template exposes. The catalog is public, so the list is available before the
 * user has entered an API key.
 */
export function useModels(): ModelLists {
  const [textModels, setTextModels] = useState<Model[]>([]);
  const [imageModels, setImageModels] = useState<Model[]>([]);
  const [searchModels, setSearchModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/models");
        if (!response.ok) return;

        const { data } = (await response.json()) as { data: CatalogEntry[] };
        if (cancelled) return;

        const text = shapeModels(data, { output: "text", streaming: true });

        setTextModels(text);
        setImageModels(shapeModels(data, { output: "image" }));
        setSearchModels(
          text.filter(
            (model) =>
              model.family === "perplexity" ||
              model.id.includes("sonar") ||
              model.id.includes("search"),
          ),
        );
      } catch {
        // silently fail — the pickers stay empty and the defaults apply
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, []);

  return { textModels, imageModels, searchModels, isLoading };
}
