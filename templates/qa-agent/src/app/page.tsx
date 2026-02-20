import { QATester, type Model } from "@/components/qa-tester";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getToolModels(): Promise<Model[]> {
  const res = await fetch("https://api.llmgateway.io/v1/models", {
    next: { revalidate: false },
  });
  const data = await res.json();

  return data.data
    .filter(
      (m: any) =>
        m.family !== "llmgateway" &&
        m.providers?.some((p: any) => p.tools === true)
    )
    .map((m: any) => ({
      id: `${m.family}/${m.id}`,
      name: m.name,
      family: m.family,
      providers: [
        ...new Set(
          m.providers
            ?.filter((p: any) => p.tools === true)
            .map((p: any) => p.providerId as string) ?? []
        ),
      ],
    }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function Home() {
  const models = await getToolModels();
  return <QATester models={models} />;
}
