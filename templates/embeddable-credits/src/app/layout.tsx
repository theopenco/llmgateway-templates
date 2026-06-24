import "@llmgateway/elements/styles.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Monetize your AI app in 5 minutes — LLM Gateway",
  description:
    "Let your end-users buy credits and use AI in-app, billed to their own wallet. Drop-in React components, one backend route. The Stripe-for-AI flagship template.",
  metadataBase: new URL("https://llmgateway.io"),
  openGraph: {
    title: "Monetize your AI app in 5 minutes",
    description:
      "Drop-in end-user wallets for AI. Your users pay for their own usage — you keep your margin. Powered by LLM Gateway.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
