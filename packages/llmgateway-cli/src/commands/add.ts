import path from "path";
import fs from "fs-extra";
import prompts from "prompts";
import { logger, highlight, dim, bold } from "../utils/logger.js";

interface AddableItem {
  name: string;
  description: string;
  files: { path: string; content: string }[];
}

const TOOLS: Record<string, AddableItem> = {
  weather: {
    name: "weather",
    description: "Get current weather data for a location",
    files: [
      {
        path: "src/tools/weather.ts",
        content: `import { tool } from "ai";
import { z } from "zod";

export const weatherTool = tool({
  description: "Get the current weather for a location",
  parameters: z.object({
    location: z.string().describe("The city and country, e.g., 'London, UK'"),
  }),
  execute: async ({ location }) => {
    // Replace with actual weather API call
    return {
      location,
      temperature: 20,
      unit: "celsius",
      condition: "Sunny",
    };
  },
});
`,
      },
    ],
  },
  search: {
    name: "search",
    description: "Search the web for information",
    files: [
      {
        path: "src/tools/search.ts",
        content: `import { tool } from "ai";
import { z } from "zod";

export const searchTool = tool({
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("The search query"),
    limit: z.number().optional().default(5).describe("Number of results to return"),
  }),
  execute: async ({ query, limit }) => {
    // Replace with actual search API call
    return {
      query,
      results: [
        { title: "Example Result", url: "https://example.com", snippet: "..." },
      ].slice(0, limit),
    };
  },
});
`,
      },
    ],
  },
  calculator: {
    name: "calculator",
    description: "Perform mathematical calculations",
    files: [
      {
        path: "src/tools/calculator.ts",
        content: `import { tool } from "ai";
import { z } from "zod";

export const calculatorTool = tool({
  description: "Perform mathematical calculations",
  parameters: z.object({
    expression: z.string().describe("The mathematical expression to evaluate, e.g., '2 + 2 * 3'"),
  }),
  execute: async ({ expression }) => {
    try {
      // Basic safe math evaluation (consider using a proper math parser in production)
      const sanitized = expression.replace(/[^0-9+\\-*/().\\s]/g, "");
      const result = Function(\`"use strict"; return (\${sanitized})\`)();
      return { expression, result };
    } catch {
      return { expression, error: "Invalid expression" };
    }
  },
});
`,
      },
    ],
  },
};

const ROUTES: Record<string, AddableItem> = {
  generate: {
    name: "generate",
    description: "API route for text generation",
    files: [
      {
        path: "src/app/api/generate/route.ts",
        content: `import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText } from "ai";
import { NextResponse } from "next/server";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

export async function POST(request: Request) {
  const { prompt, model = "openai/gpt-4o" } = await request.json();

  const result = await generateText({
    model: llmgateway(model),
    prompt,
  });

  return NextResponse.json({ text: result.text });
}
`,
      },
    ],
  },
  chat: {
    name: "chat",
    description: "API route for chat completions with streaming",
    files: [
      {
        path: "src/app/api/chat/route.ts",
        content: `import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { streamText } from "ai";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

export async function POST(request: Request) {
  const { messages, model = "openai/gpt-4o" } = await request.json();

  const result = streamText({
    model: llmgateway(model),
    messages,
  });

  return result.toDataStreamResponse();
}
`,
      },
    ],
  },
};

type ItemType = "tool" | "route";

export async function add(type?: string, name?: string): Promise<void> {
  let itemType = type as ItemType | undefined;
  let itemName = name;

  // Interactive mode
  if (!itemType) {
    const response = await prompts({
      type: "select",
      name: "type",
      message: "What would you like to add?",
      choices: [
        { title: "Tool", value: "tool", description: "AI tool for agents" },
        { title: "Route", value: "route", description: "API route" },
      ],
    });

    if (!response.type) {
      process.exit(1);
    }

    itemType = response.type;
  }

  const items = itemType === "tool" ? TOOLS : ROUTES;
  const availableItems = Object.keys(items);

  if (!itemName) {
    const response = await prompts({
      type: "select",
      name: "name",
      message: `Which ${itemType} would you like to add?`,
      choices: availableItems.map((key) => ({
        title: key,
        value: key,
        description: items[key].description,
      })),
    });

    if (!response.name) {
      process.exit(1);
    }

    itemName = response.name as string;
  }

  const item = items[itemName!];
  if (!item) {
    logger.error(`Unknown ${itemType}: ${itemName}`);
    logger.blank();
    logger.log(`Available ${itemType}s:`);
    availableItems.forEach((key) => {
      logger.log(`  ${highlight(key)} - ${items[key].description}`);
    });
    process.exit(1);
  }

  const cwd = process.cwd();

  logger.blank();
  logger.log(bold(`Adding ${itemType}: ${item.name}`));
  logger.blank();

  for (const file of item.files) {
    const filePath = path.join(cwd, file.path);
    const dir = path.dirname(filePath);

    // Check if file already exists
    if (await fs.pathExists(filePath)) {
      const response = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `${file.path} already exists. Overwrite?`,
        initial: false,
      });

      if (!response.overwrite) {
        logger.log(dim(`Skipped ${file.path}`));
        continue;
      }
    }

    await fs.ensureDir(dir);
    await fs.writeFile(filePath, file.content);
    logger.success(`Created ${highlight(file.path)}`);
  }

  logger.blank();
  logger.log(dim("Don't forget to import and use the added code in your project."));
  logger.blank();
}
