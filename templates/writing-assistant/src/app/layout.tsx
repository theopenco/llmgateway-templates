import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Writing Assistant - LLM Gateway",
  description: "AI writing assistant with text actions powered by LLM Gateway",
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
