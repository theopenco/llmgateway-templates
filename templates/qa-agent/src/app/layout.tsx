import type { Metadata } from "next";
import { ApiKeyProvider } from "@/components/api-key-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI QA Tester - LLM Gateway",
  description:
    "AI-powered QA testing agent using Playwright MCP and LLM Gateway",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ApiKeyProvider>{children}</ApiKeyProvider>
      </body>
    </html>
  );
}
