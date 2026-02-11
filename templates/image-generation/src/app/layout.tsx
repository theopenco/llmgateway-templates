import type { Metadata } from "next";
import { ApiKeyProvider } from "@/components/api-key-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Generation - LLM Gateway",
  description: "Generate images using AI with LLM Gateway",
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
