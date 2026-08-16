import { OgGenerator } from "@/components/og-generator";
import { fetchModels, pickDefaultModel } from "@/lib/models";

export default async function Home() {
  const models = await fetchModels({ output: "image" });

  return (
    <OgGenerator
      models={models}
      defaultModel={pickDefaultModel(models, "gemini-3.1-flash-image-preview")}
    />
  );
}
