import { QATester } from "@/components/qa-tester";
import { fetchModels, pickDefaultModel } from "@/lib/models";

export default async function Home() {
  // The browser agent drives the page with tools, so only tool-capable models
  // are offered.
  const models = await fetchModels({ output: "text", tools: true });

  return (
    <QATester
      models={models}
      defaultModel={pickDefaultModel(models, "claude-sonnet-5")}
    />
  );
}
