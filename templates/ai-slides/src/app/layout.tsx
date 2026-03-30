import type { Metadata } from "next";
import { ApiKeyProvider } from "@/components/api-key-provider";
import { Toaster } from "@/components/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Slides Creator - LLM Gateway",
  description: "Create AI-powered presentations with LLM Gateway",
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
          <Toaster />
        </body>
    </html>
  );
}