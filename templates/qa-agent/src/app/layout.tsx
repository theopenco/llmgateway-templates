import type { Metadata } from "next";
import { connection } from "next/server";
import { ApiKeyProvider } from "@/components/api-key-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI QA Tester - LLM Gateway",
  description:
    "AI-powered QA testing agent using Playwright MCP and LLM Gateway",
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
