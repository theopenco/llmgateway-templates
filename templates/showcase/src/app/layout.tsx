import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Showcase — Built with LLM Gateway",
  description:
    "A directory of apps built with LLM Gateway templates. Browse what other developers shipped, then build your own.",
  metadataBase: new URL("https://llmgateway.io"),
  openGraph: {
    title: "Showcase — Built with LLM Gateway",
    description:
      "A directory of apps built with LLM Gateway templates. Browse, get inspired, ship your own.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
