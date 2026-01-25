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
    name: "weather-agent",
    description: "CLI agent that answers weather queries using tools",
    category: "agent",
    path: "agents/weather-agent",
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
