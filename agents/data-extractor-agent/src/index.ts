import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const entitiesSchema = z.object({
  people: z
    .array(z.string())
    .describe("Names of people mentioned in the text"),
  organizations: z
    .array(z.string())
    .describe("Names of companies, institutions, or organizations"),
  dates: z
    .array(z.string())
    .describe("Dates or time references mentioned"),
  monetaryAmounts: z
    .array(z.string())
    .describe("Money amounts with currency"),
  locations: z
    .array(z.string())
    .describe("Cities, countries, addresses, or geographic locations"),
  emails: z
    .array(z.string())
    .describe("Email addresses found in the text"),
  phoneNumbers: z
    .array(z.string())
    .describe("Phone numbers found in the text"),
});

async function runDataExtractor(
  text: string
): Promise<z.infer<typeof entitiesSchema>> {
  const result = await generateText({
    model: llmgateway("openai/gpt-4o-mini"),
    output: Output.object({ schema: entitiesSchema }),
    system: `You are a data extraction specialist. Extract all structured entities from the given unstructured text.

Guidelines:
- Extract every instance of each entity type
- Normalize names (e.g., "Dr. Smith" and "John Smith" should both appear)
- Keep monetary amounts with their currency symbols
- Preserve date formats as written, but also note relative dates (e.g., "next Tuesday")
- Include partial matches when confident (e.g., first names only if clearly a person)
- Return empty arrays for entity types not found in the text
- Do not fabricate entities that aren't in the source text`,
    prompt: `Extract all entities from the following text:\n\n${text}`,
  });

  return result.output;
}

async function main() {
  const input = process.argv.slice(2).join(" ");

  if (!input || input === "--help") {
    console.log("Data Extractor Agent - Powered by LLM Gateway\n");
    console.log("Usage: node dist/index.js <text>\n");
    console.log("Examples:");
    console.log(
      '  node dist/index.js "John Smith from Acme Corp signed a $50k deal on Jan 15"'
    );
    console.log(
      '  node dist/index.js "Contact jane@example.com or call 555-0123 for details"'
    );
    process.exit(0);
  }

  console.log("Data Extractor Agent - Powered by LLM Gateway\n");
  console.log("=".repeat(50));
  console.log(
    `\nInput: ${input.length > 100 ? input.slice(0, 100) + "..." : input}`
  );
  console.log("-".repeat(50));

  const entities = await runDataExtractor(input);

  const sections: [string, string[]][] = [
    ["People", entities.people],
    ["Organizations", entities.organizations],
    ["Dates", entities.dates],
    ["Monetary Amounts", entities.monetaryAmounts],
    ["Locations", entities.locations],
    ["Emails", entities.emails],
    ["Phone Numbers", entities.phoneNumbers],
  ];

  for (const [label, items] of sections) {
    if (items.length > 0) {
      console.log(`\n${label}:`);
      for (const item of items) {
        console.log(`  - ${item}`);
      }
    }
  }

  const totalEntities = sections.reduce(
    (sum, [, items]) => sum + items.length,
    0
  );
  console.log(`\nTotal entities found: ${totalEntities}`);
  console.log("\n" + "=".repeat(50));
}

main().catch(console.error);
