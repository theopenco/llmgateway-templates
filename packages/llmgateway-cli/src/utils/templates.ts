export interface Template {
  name: string;
  description: string;
  category: "web" | "agent";
  path: string;
}

export const templates: Template[] = [
  {
    name: "image-generation",
    description: "Full-stack AI image generation app (Next.js 16, React 19)",
    category: "web",
    path: "templates/image-generation",
  },
  {
    name: "ai-chatbot",
    description: "AI chatbot with streaming responses",
    category: "web",
    path: "templates/ai-chatbot",
  },
  {
    name: "og-image-generator",
    description: "AI-powered OG image generator",
    category: "web",
    path: "templates/og-image-generator",
  },
  {
    name: "feedback-dashboard",
    description: "Customer feedback sentiment dashboard",
    category: "web",
    path: "templates/feedback-dashboard",
  },
  {
    name: "writing-assistant",
    description: "AI writing assistant with text actions",
    category: "web",
    path: "templates/writing-assistant",
  },
  {
    name: "weather-agent",
    description: "CLI agent that answers weather queries using tools",
    category: "agent",
    path: "agents/weather-agent",
  },
  {
    name: "lead-agent",
    description: "CLI agent that researches people and posts to Discord",
    category: "agent",
    path: "agents/lead-agent",
  },
  {
    name: "changelog-generator-agent",
    description: "CLI agent that generates changelogs from git history",
    category: "agent",
    path: "agents/changelog-generator-agent",
  },
  {
    name: "email-drafter-agent",
    description: "CLI agent that drafts polished emails from notes",
    category: "agent",
    path: "agents/email-drafter-agent",
  },
  {
    name: "sentiment-analyzer-agent",
    description: "CLI agent that analyzes text sentiment",
    category: "agent",
    path: "agents/sentiment-analyzer-agent",
  },
  {
    name: "data-extractor-agent",
    description: "CLI agent that extracts structured entities from text",
    category: "agent",
    path: "agents/data-extractor-agent",
  },
];

export function getTemplate(name: string): Template | undefined {
  return templates.find((t) => t.name === name);
}

export function getTemplatesByCategory(category: "web" | "agent"): Template[] {
  return templates.filter((t) => t.category === category);
}

export const DEFAULT_TEMPLATE = "image-generation";
export const REPO = "theopenco/llmgateway-templates";
