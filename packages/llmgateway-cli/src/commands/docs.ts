import open from "open";
import { logger, highlight, dim } from "../utils/logger.js";

const DOCS_URLS: Record<string, string> = {
  default: "https://docs.llmgateway.io",
  models: "https://docs.llmgateway.io/models",
  api: "https://docs.llmgateway.io/api-reference",
  sdk: "https://docs.llmgateway.io/sdk",
  quickstart: "https://docs.llmgateway.io/quickstart",
};

export async function docs(topic?: string): Promise<void> {
  const url = topic ? DOCS_URLS[topic] || DOCS_URLS.default : DOCS_URLS.default;

  logger.blank();
  logger.log(`Opening documentation...`);
  logger.log(dim(url));
  logger.blank();

  await open(url);

  if (!topic) {
    logger.log(dim("Available topics:"));
    Object.keys(DOCS_URLS)
      .filter((k) => k !== "default")
      .forEach((key) => {
        logger.log(`  ${highlight(key.padEnd(12))} ${dim(DOCS_URLS[key])}`);
      });
    logger.blank();
    logger.log(dim(`Run ${highlight("npx @llmgateway/cli docs <topic>")} to open specific docs`));
    logger.blank();
  }
}
