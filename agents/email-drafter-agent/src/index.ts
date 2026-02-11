import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const emailSchema = z.object({
  subject: z.string().describe("A concise, professional email subject line"),
  body: z.string().describe("The full email body text"),
  signoff: z
    .string()
    .describe("The closing line, e.g., 'Best regards,' or 'Thanks,'"),
});

async function runEmailDrafter(
  notes: string,
  tone: string
): Promise<z.infer<typeof emailSchema>> {
  const result = await generateText({
    model: llmgateway("openai/gpt-4o-mini"),
    output: Output.object({ schema: emailSchema }),
    system: `You are an email drafting assistant. Given a set of bullet points or rough notes, draft a polished email.

Tone: ${tone}

Guidelines:
- Write a clear, relevant subject line
- Structure the body with proper greeting, content, and flow
- Keep paragraphs short and scannable
- Match the requested tone throughout
- End with an appropriate sign-off for the tone`,
    prompt: `Draft an email from these notes:\n\n${notes}`,
  });

  return result.output;
}

function parseToneFlag(args: string[]): string {
  const toneIndex = args.indexOf("--tone");
  if (toneIndex !== -1 && toneIndex + 1 < args.length) {
    return args[toneIndex + 1];
  }
  return "professional";
}

function parseNotes(args: string[]): string {
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tone") {
      i++; // skip the tone value
      continue;
    }
    filtered.push(args[i]);
  }
  return filtered.join(" ");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    console.log("Email Drafter Agent - Powered by LLM Gateway\n");
    console.log("Usage: node dist/index.js <notes> [--tone <tone>]\n");
    console.log("Examples:");
    console.log(
      '  node dist/index.js "meeting tomorrow at 3pm, need to reschedule to Friday"'
    );
    console.log(
      '  node dist/index.js "thank client for contract, next steps onboarding" --tone formal'
    );
    console.log(
      '  node dist/index.js "team lunch Friday, bring ideas for venue" --tone casual'
    );
    process.exit(0);
  }

  const tone = parseToneFlag(args);
  const notes = parseNotes(args);

  console.log("Email Drafter Agent - Powered by LLM Gateway\n");
  console.log("=".repeat(50));
  console.log(`\nTone: ${tone}`);
  console.log(`Notes: ${notes}`);
  console.log("-".repeat(50));

  const email = await runEmailDrafter(notes, tone);

  console.log(`\nSubject: ${email.subject}\n`);
  console.log(email.body);
  console.log(`\n${email.signoff}`);
  console.log("\n" + "=".repeat(50));
}

main().catch(console.error);
