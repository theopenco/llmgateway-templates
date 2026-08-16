/**
 * Model catalog helpers.
 *
 * The list of models is read from the gateway's public `/v1/models` endpoint
 * instead of being hardcoded, so a template picks up newly added models without
 * a code change. Model ids are used bare (`gpt-5.4-mini`, not
 * `openai/gpt-5.4-mini`) so the gateway smart-routes each request to the best
 * available provider; prefixing with a provider id would pin the request to
 * that one provider and disable failover.
 *
 * @see https://docs.llmgateway.io/features/routing
 */

export const MODELS_URL = "https://api.llmgateway.io/v1/models";

/** How long a fetched catalog is cached before Next.js revalidates it. */
export const MODELS_REVALIDATE_SECONDS = 3600;

export type Model = {
  /** Root gateway model id, e.g. `claude-sonnet-5`. */
  id: string;
  name: string;
  /** Model author, e.g. `anthropic`. Used to group the selector. */
  family: string;
  /** Upstream providers that can serve this model. */
  providers: string[];
};

export type ModelFilter = {
  /** `text` keeps chat/completion models, `image` keeps image generation models. */
  output?: "text" | "image";
  /** Only keep models that at least one provider can stream. */
  streaming?: boolean;
  /** Only keep models that at least one provider supports tool calling for. */
  tools?: boolean;
};

type CatalogProvider = {
  providerId: string;
  streaming?: boolean;
  tools?: boolean;
};

export type CatalogEntry = {
  id: string;
  name?: string;
  family: string;
  created?: number;
  architecture?: { output_modalities?: string[] };
  providers?: CatalogProvider[];
};

/** Families shown first; everything else follows alphabetically. */
const FAMILY_ORDER = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "deepseek",
  "moonshot",
  "zai",
  "alibaba",
  "minimax",
  "bytedance",
  "meta",
  "mistral",
  "nvidia",
  "perplexity",
];

/**
 * Used when the catalog can't be reached (offline build, gateway hiccup) so the
 * template still renders a working picker.
 */
const FALLBACK: Record<"text" | "image", Model[]> = {
  text: [
    {
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      family: "openai",
      providers: ["openai"],
    },
    { id: "gpt-5.5", name: "GPT-5.5", family: "openai", providers: ["openai"] },
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5",
      family: "anthropic",
      providers: ["anthropic"],
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      family: "anthropic",
      providers: ["anthropic"],
    },
    {
      id: "gemini-3.7-flash",
      name: "Gemini 3.7 Flash",
      family: "google",
      providers: ["google-ai-studio"],
    },
    { id: "grok-4-6", name: "Grok 4.6", family: "xai", providers: ["xai"] },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      family: "deepseek",
      providers: ["deepseek"],
    },
    {
      id: "kimi-k3",
      name: "Kimi K3",
      family: "moonshot",
      providers: ["moonshot"],
    },
    { id: "glm-5.2", name: "GLM-5.2", family: "zai", providers: ["zai"] },
    {
      id: "minimax-m3",
      name: "MiniMax M3",
      family: "minimax",
      providers: ["minimax"],
    },
  ],
  image: [
    {
      id: "gemini-3.1-flash-image-preview",
      name: "Gemini 3.1 Flash Image (Preview)",
      family: "google",
      providers: ["google-ai-studio"],
    },
    {
      id: "gemini-3-pro-image-preview",
      name: "Gemini 3 Pro Image (Preview)",
      family: "google",
      providers: ["google-ai-studio"],
    },
    {
      id: "gpt-image-2",
      name: "GPT Image 2",
      family: "openai",
      providers: ["openai"],
    },
    {
      id: "seedream-5-0-pro",
      name: "Seedream 5.0 Pro",
      family: "bytedance",
      providers: ["bytedance"],
    },
    {
      id: "grok-imagine-image-2-0",
      name: "Grok Imagine Image 2.0",
      family: "xai",
      providers: ["xai"],
    },
    {
      id: "qwen-image-3.0",
      name: "Qwen Image 3.0",
      family: "alibaba",
      providers: ["alibaba"],
    },
  ],
};

/**
 * Turn raw `/v1/models` entries into selector-ready models: filtered by
 * capability, newest first inside each family.
 */
export function shapeModels(
  entries: CatalogEntry[],
  { output = "text", streaming, tools }: ModelFilter = {},
): Model[] {
  return entries
    .filter((entry) => {
      // `llmgateway` holds the `custom` and `auto` pseudo-models.
      if (entry.family === "llmgateway") return false;

      const modalities = entry.architecture?.output_modalities ?? [];
      const isImage = modalities.includes("image");
      // Anything that isn't plain text out (embeddings, tts, video, ocr…) is
      // not usable from these templates.
      const isText = modalities.length === 1 && modalities[0] === "text";
      if (output === "image" ? !isImage : !isText) return false;

      const providers = entry.providers ?? [];
      if (streaming && !providers.some((p) => p.streaming)) return false;
      if (tools && !providers.some((p) => p.tools)) return false;
      return providers.length > 0;
    })
    .sort((a, b) => {
      const familyDelta =
        familyRank(a.family) - familyRank(b.family) ||
        a.family.localeCompare(b.family);
      if (familyDelta !== 0) return familyDelta;
      return (b.created ?? 0) - (a.created ?? 0);
    })
    .map((entry) => ({
      id: entry.id,
      name: entry.name || entry.id,
      family: entry.family,
      providers: [
        ...new Set(
          (entry.providers ?? [])
            .filter((p) => (tools ? p.tools : true))
            .map((p) => p.providerId),
        ),
      ],
    }));
}

function familyRank(family: string) {
  const index = FAMILY_ORDER.indexOf(family);
  return index === -1 ? FAMILY_ORDER.length : index;
}

/** Fetch the gateway catalog. Falls back to a small static list on failure. */
export async function fetchModels(filter: ModelFilter = {}): Promise<Model[]> {
  try {
    const response = await fetch(MODELS_URL, {
      next: { revalidate: MODELS_REVALIDATE_SECONDS },
    });
    if (!response.ok) throw new Error(`models: ${response.status}`);

    const { data } = (await response.json()) as { data: CatalogEntry[] };
    const models = shapeModels(data, filter);
    return models.length > 0 ? models : FALLBACK[filter.output ?? "text"];
  } catch {
    return FALLBACK[filter.output ?? "text"];
  }
}

/** Ordered `[family, models]` pairs, ready to render as selector groups. */
export function groupByFamily(models: Model[]): [string, Model[]][] {
  const groups = new Map<string, Model[]>();
  for (const model of models) {
    const group = groups.get(model.family);
    if (group) group.push(model);
    else groups.set(model.family, [model]);
  }
  return [...groups];
}

/**
 * Pick the starting model: the preferred id when the gateway still serves it,
 * otherwise the first model in the list.
 */
export function pickDefaultModel(models: Model[], preferred: string) {
  return models.some((m) => m.id === preferred)
    ? preferred
    : (models[0]?.id ?? preferred);
}
