import { Arena } from "@/components/arena";
import { fetchModels } from "@/lib/models";

const PREFERRED = ["gpt-6-luna", "claude-sonnet-5-5", "gemini-3.8-flash"];

export default async function Home() {
  const models = await fetchModels({ output: "text", streaming: true });
  const available = new Set(models.map((model) => model.id));
  const defaults = [
    ...PREFERRED.filter((id) => available.has(id)),
    ...models.map((model) => model.id).filter((id) => !PREFERRED.includes(id)),
  ].slice(0, 3);

  return <Arena models={models} defaultModels={defaults} />;
}
