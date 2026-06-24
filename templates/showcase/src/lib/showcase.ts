export interface ShowcaseEntry {
  /** Stable id, used for the index list. */
  slug: string;
  /** App name. */
  name: string;
  /** One-line description of what it does. */
  tagline: string;
  /** Where people can go see it (a live app, or the template source). */
  url: string;
  /** Who built it. */
  author: string;
  /** The template it was built from (matches the names in the CLI). */
  template: string;
  /** Free-form tags for filtering. */
  tags: string[];
  /**
   * `official` — a template shipped in this repo, a ready starting point.
   * `community` — something a developer built and submitted.
   */
  type: "official" | "community";
}

const REPO = "https://github.com/theopenco/llmgateway-templates/tree/main";

/**
 * The gallery seed. It starts with the official templates so the page is never
 * empty — then community apps land here via pull request. To add yours, append
 * an entry and open a PR, or use the "Submit your app" button (which opens a
 * pre-filled GitHub issue).
 */
export const SHOWCASE: ShowcaseEntry[] = [
  {
    slug: "embeddable-credits",
    name: "Embeddable Credits",
    tagline:
      "Let your end-users buy credits and use AI billed to their own wallet — the Stripe-for-AI flagship.",
    url: `${REPO}/templates/embeddable-credits`,
    author: "LLM Gateway",
    template: "embeddable-credits",
    tags: ["payments", "wallets", "chat", "saas"],
    type: "official",
  },
  {
    slug: "image-generation",
    name: "Image Studio",
    tagline: "Full-stack image generation app with prompt history and downloads.",
    url: `${REPO}/templates/image-generation`,
    author: "LLM Gateway",
    template: "image-generation",
    tags: ["images", "generation"],
    type: "official",
  },
  {
    slug: "ai-chatbot",
    name: "Streaming Chatbot",
    tagline: "A streaming chat with conversation history and a model switcher.",
    url: `${REPO}/templates/ai-chatbot`,
    author: "LLM Gateway",
    template: "ai-chatbot",
    tags: ["chat", "streaming"],
    type: "official",
  },
  {
    slug: "og-image-generator",
    name: "OG Image Forge",
    tagline: "Generate Open Graph images from a prompt, preview, and download.",
    url: `${REPO}/templates/og-image-generator`,
    author: "LLM Gateway",
    template: "og-image-generator",
    tags: ["images", "marketing", "og"],
    type: "official",
  },
  {
    slug: "ai-slides",
    name: "Deck Builder",
    tagline: "Turn a topic into a full slide deck, generated section by section.",
    url: `${REPO}/templates/ai-slides`,
    author: "LLM Gateway",
    template: "ai-slides",
    tags: ["slides", "generation", "productivity"],
    type: "official",
  },
  {
    slug: "writing-assistant",
    name: "Writing Assistant",
    tagline: "Inline rewrite, summarize, and expand actions over any text.",
    url: `${REPO}/templates/writing-assistant`,
    author: "LLM Gateway",
    template: "writing-assistant",
    tags: ["writing", "productivity"],
    type: "official",
  },
  {
    slug: "feedback-dashboard",
    name: "Sentiment Dashboard",
    tagline: "Customer feedback sentiment analysis with a live dashboard.",
    url: `${REPO}/templates/feedback-dashboard`,
    author: "LLM Gateway",
    template: "feedback-dashboard",
    tags: ["analytics", "sentiment", "dashboard"],
    type: "official",
  },
  {
    slug: "slack-qa-bot",
    name: "Slack Q&A Bot",
    tagline: "A Slack bot that streams AI answers and keeps thread context.",
    url: `${REPO}/templates/slack-qa-bot`,
    author: "LLM Gateway",
    template: "slack-qa-bot",
    tags: ["slack", "bot", "chat"],
    type: "official",
  },
  {
    slug: "qa-agent",
    name: "QA Agent",
    tagline: "An AI QA testing agent with a live browser preview.",
    url: `${REPO}/templates/qa-agent`,
    author: "LLM Gateway",
    template: "qa-agent",
    tags: ["testing", "agent", "browser"],
    type: "official",
  },
];

export const ALL_TAGS: string[] = Array.from(
  new Set(SHOWCASE.flatMap((e) => e.tags)),
).sort();

export const SHOWCASE_REPO =
  process.env.NEXT_PUBLIC_SHOWCASE_REPO ?? "theopenco/llmgateway-templates";

/** Opens a pre-filled "Submit your app" issue. */
export const SUBMIT_URL = `https://github.com/${SHOWCASE_REPO}/issues/new?template=showcase-submission.yml&labels=showcase`;
