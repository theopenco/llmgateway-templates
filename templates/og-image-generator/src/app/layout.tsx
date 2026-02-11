import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OG Image Generator - LLM Gateway",
  description: "AI-powered Open Graph image generator with LLM Gateway",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
