import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { Output, generateText } from "ai";
import { z } from "zod";

const llmgateway = createLLMGateway({
  baseURL: process.env.LLMGATEWAY_GATEWAY_URL
    ? `${process.env.LLMGATEWAY_GATEWAY_URL.replace(/\/+$/, "")}/v1`
    : undefined,
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const MODEL = process.env.LLMGATEWAY_MODEL || "gemini-3.8-flash";

const notesSchema = z.object({
  title: z.string().describe("Short meeting title"),
  summary: z.string().describe("3-5 sentence summary of the meeting"),
  attendees: z
    .array(z.string())
    .describe("People who spoke or were mentioned as present"),
  decisions: z.array(z.string()).describe("Decisions that were agreed on"),
  actionItems: z.array(
    z.object({
      owner: z.string().describe("Person responsible, or 'Unassigned'"),
      task: z.string().describe("What needs to be done, starting with a verb"),
      due: z.string().nullable().describe("Due date as stated, or null"),
    }),
  ),
  openQuestions: z.array(z.string()).describe("Questions left unresolved"),
  risks: z.array(z.string()).describe("Risks or blockers raised"),
});

type Notes = z.infer<typeof notesSchema>;

const SAMPLE = `Priya: Okay, let's start. Main thing today is the v2 launch date.
Tom: Backend is ready except the billing migration. I need until Thursday.
Priya: Then we move launch from Monday the 20th to Wednesday the 22nd. Everyone okay?
Ana: Works for me. Marketing assets are done, I'll reschedule the newsletter.
Tom: One risk: the payment provider sandbox has been flaky this week.
Priya: Tom, can you add a fallback test plan by Friday? And Ana, please confirm the press embargo with the agency.
Ana: Sure. Do we know if the enterprise customers get early access?
Priya: Not decided yet, let's take that to the leadership sync.`;

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "_None_";
}

function toMarkdown(notes: Notes): string {
  const actions = notes.actionItems.length
    ? notes.actionItems
        .map(
          (a) =>
            `- [ ] **${a.owner}** — ${a.task}${a.due ? ` _(due ${a.due})_` : ""}`,
        )
        .join("\n")
    : "_None_";
  return [
    `# ${notes.title}`,
    "",
    notes.summary,
    "",
    `**Attendees:** ${notes.attendees.join(", ") || "Unknown"}`,
    "",
    "## Decisions",
    list(notes.decisions),
    "",
    "## Action items",
    actions,
    "",
    "## Open questions",
    list(notes.openQuestions),
    "",
    "## Risks",
    list(notes.risks),
  ].join("\n");
}

async function postToWebhook(markdown: string) {
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  const targets: { url: string; body: Record<string, string> }[] = [];
  if (slack) targets.push({ url: slack, body: { text: markdown } });
  if (discord) {
    targets.push({ url: discord, body: { content: markdown.slice(0, 2000) } });
  }
  for (const target of targets) {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target.body),
    });
    console.error(
      response.ok
        ? "Posted notes to webhook."
        : `Webhook failed: ${response.status} ${response.statusText}`,
    );
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      post: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log("Meeting Notes Agent - Powered by LLM Gateway\n");
    console.log(
      "Usage: pnpm start [transcript.txt] [--out notes.md] [--post]\n",
    );
    console.log(
      "  transcript.txt  Transcript file (.txt, .md, .vtt, .srt). Uses a sample if omitted.",
    );
    console.log("  --out <file>    Write the markdown notes to a file");
    console.log(
      "  --post          Post notes to SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL",
    );
    return;
  }

  const file = positionals[0];
  if (file && !existsSync(file)) throw new Error(`File not found: ${file}`);
  const transcript = file ? readFileSync(file, "utf-8") : SAMPLE;

  console.error(`Summarizing ${file ?? "sample transcript"} with ${MODEL}…`);

  const { output } = await generateText({
    model: llmgateway(MODEL),
    output: Output.object({ schema: notesSchema }),
    instructions: `You turn raw meeting transcripts into accurate notes.
- Only include facts stated in the transcript.
- Capture every commitment as an action item with its owner and due date.
- Resolve relative dates only when the transcript makes them explicit.
- Ignore timestamps, filler and cross-talk.`,
    prompt: transcript,
  });

  const markdown = toMarkdown(output);
  console.log(`\n${markdown}\n`);

  if (values.out) {
    await writeFile(values.out, `${markdown}\n`);
    console.error(`Saved notes to ${values.out}`);
  }
  if (values.post) await postToWebhook(markdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
