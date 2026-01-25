import { models } from "@llmgateway/models";
import { logger, highlight, dim, bold } from "../utils/logger.js";

interface ModelsOptions {
  capability?: string;
  provider?: string;
  search?: string;
  json?: boolean;
}

interface Model {
  id: string;
  name: string;
  provider?: string;
  output?: string[];
  input?: string[];
}

export async function listModels(options: ModelsOptions): Promise<void> {
  let filteredModels = models as Model[];

  // Filter by capability (output type)
  if (options.capability) {
    filteredModels = filteredModels.filter((model) => {
      const output = model.output;
      return Array.isArray(output) && output.includes(options.capability!);
    });
  }

  // Filter by provider
  if (options.provider) {
    const providerLower = options.provider.toLowerCase();
    filteredModels = filteredModels.filter((model) => {
      const modelProvider = model.id.split("/")[0]?.toLowerCase();
      return modelProvider?.includes(providerLower);
    });
  }

  // Filter by search term
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filteredModels = filteredModels.filter(
      (model) =>
        model.id.toLowerCase().includes(searchLower) ||
        model.name.toLowerCase().includes(searchLower)
    );
  }

  if (options.json) {
    console.log(JSON.stringify(filteredModels, null, 2));
    return;
  }

  logger.blank();
  logger.log(bold(`Available models (${filteredModels.length}):`));
  logger.blank();

  if (filteredModels.length === 0) {
    logger.log(dim("  No models found matching your criteria."));
    logger.blank();
    return;
  }

  // Group by provider
  const byProvider = new Map<string, Model[]>();
  for (const model of filteredModels) {
    const provider = model.id.split("/")[0] || "unknown";
    if (!byProvider.has(provider)) {
      byProvider.set(provider, []);
    }
    byProvider.get(provider)!.push(model);
  }

  for (const [provider, providerModels] of byProvider) {
    logger.log(dim(`  ${provider}:`));
    for (const model of providerModels.slice(0, 10)) {
      const capabilities = model.output?.join(", ") || "text";
      logger.log(`    ${highlight(model.id.padEnd(50))} ${dim(capabilities)}`);
    }
    if (providerModels.length > 10) {
      logger.log(dim(`    ... and ${providerModels.length - 10} more`));
    }
    logger.blank();
  }

  logger.log(dim("Filter options:"));
  logger.log(dim("  --capability image    Show only image generation models"));
  logger.log(dim("  --provider openai     Show only OpenAI models"));
  logger.log(dim("  --search gpt          Search models by name"));
  logger.blank();
}
