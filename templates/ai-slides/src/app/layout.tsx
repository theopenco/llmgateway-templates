import type { Metadata } from "next";
import { connection } from "next/server";
import { ApiKeyProvider } from "@/components/api-key-provider";
import { Toaster } from "@/components/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Slides Creator - LLM Gateway",
  description: "Create AI-powered presentations with LLM Gateway",
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
        <Toaster />
      </body>
    </html>
  );
}
