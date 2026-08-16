import { Chat } from "@/components/chat";
import { fetchModels, pickDefaultModel } from "@/lib/models";

export default async function Home() {
  const models = await fetchModels({ output: "text", streaming: true });

  return (
    <Chat
      models={models}
      defaultModel={pickDefaultModel(models, "gpt-5.4-mini")}
    />
  );
}
