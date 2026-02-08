import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText } from "ai";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

async function sendToDiscord(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      "Discord is not configured. Set the DISCORD_WEBHOOK_URL environment variable to enable Discord notifications."
    );
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });

  if (!response.ok) {
    console.error(
      `Failed to send to Discord: ${response.status} ${response.statusText}`
    );
  } else {
    console.log("Summary sent to Discord successfully.");
  }
}

async function runLeadAgent(query: string): Promise<string> {
  const result = await generateText({
    model: llmgateway("perplexity/sonar-pro"),
    system: `You are a lead research agent. Given a person's name or email address, research them thoroughly using your built-in web search capabilities.

Produce a structured summary with the following sections:
- **Name**: Full name
- **Bio**: A brief biography (2-3 sentences)
- **Current Role**: Job title and company
- **Background**: Education, previous roles, notable achievements
- **Social Links**: Any public profiles (LinkedIn, Twitter/X, GitHub, personal website, etc.)

If the person cannot be found or the query is ambiguous, explain what you found and ask for clarification.
Format the summary in a clean, readable way.`,
    prompt: query,
  });

  return result.text;
}

async function main() {
  const query = process.argv[2] || "Sam Altman";

  console.log("Lead Agent - Powered by LLM Gateway\n");
  console.log("=".repeat(50));
  console.log(`\nResearching: ${query}`);
  console.log("-".repeat(50));

  const response = await runLeadAgent(query);
  console.log(`\n${response}`);
  console.log("\n" + "=".repeat(50));

  await sendToDiscord(response);
}

main().catch(console.error);
