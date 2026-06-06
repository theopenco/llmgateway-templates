import "@llmgateway/elements/styles.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "LLM Gateway — Embeddable Credits Demo",
  description:
    "Let your end-users buy credits and use AI in-app, powered by LLM Gateway.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
