import { logger, highlight, dim, bold } from "../utils/logger.js";
import { templates, getTemplatesByCategory } from "../utils/templates.js";

interface ListOptions {
  json?: boolean;
}

export async function list(options: ListOptions): Promise<void> {
  if (options.json) {
    console.log(JSON.stringify(templates, null, 2));
    return;
  }

  logger.blank();
  logger.log(bold("Available templates:"));
  logger.blank();

  const webTemplates = getTemplatesByCategory("web");
  const agentTemplates = getTemplatesByCategory("agent");

  if (webTemplates.length > 0) {
    logger.log(dim("  Web Applications:"));
    webTemplates.forEach((t) => {
      logger.log(`    ${highlight(t.name.padEnd(20))} ${t.description}`);
    });
    logger.blank();
  }

  if (agentTemplates.length > 0) {
    logger.log(dim("  CLI Agents:"));
    agentTemplates.forEach((t) => {
      logger.log(`    ${highlight(t.name.padEnd(20))} ${t.description}`);
    });
    logger.blank();
  }

  logger.log(
    dim(`Run ${highlight("npx @llmgateway/cli init --template <name>")} to create a new project`)
  );
  logger.blank();
}
