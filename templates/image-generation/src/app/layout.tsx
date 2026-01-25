import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
