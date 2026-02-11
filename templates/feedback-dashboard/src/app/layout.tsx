import type { Metadata } from "next";
import { ApiKeyProvider } from "@/components/api-key-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feedback Dashboard - LLM Gateway",
  description:
    "Customer feedback sentiment analysis dashboard powered by LLM Gateway",
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
