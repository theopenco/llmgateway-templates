import type { Metadata } from "next";
import { connection } from "next/server";
import { ApiKeyProvider } from "@/components/api-key-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feedback Dashboard - LLM Gateway",
  description:
    "Customer feedback sentiment analysis dashboard powered by LLM Gateway",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the env var at request time so a key added after the build is picked up.
  await connection();
  const hasEnvironmentApiKey = Boolean(process.env.LLMGATEWAY_API_KEY?.trim());

  return (
    <html lang="en">
      <body>
        <ApiKeyProvider hasEnvironmentApiKey={hasEnvironmentApiKey}>
          {children}
        </ApiKeyProvider>
      </body>
    </html>
  );
}
