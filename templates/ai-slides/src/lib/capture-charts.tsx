"use client";

import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import {
  BarChartComponent,
  LineChartComponent,
  AreaChartComponent,
  PieChartComponent,
} from "@/components/chart-components";
import type { Slide } from "./types";

function renderChart(
  chartSpec: Record<string, unknown>,
  colors?: string[]
): React.ReactNode {
  const root = chartSpec.root as string | undefined;
  const elements = chartSpec.elements as
    | Record<string, { type: string; props: Record<string, unknown> }>
    | undefined;

  if (!root || !elements) return null;
  const element = elements[root];
  if (!element) return null;

  const props = element.props as any;

  switch (element.type) {
    case "BarChart":
      return <BarChartComponent props={props} colors={colors} />;
    case "LineChart":
      return <LineChartComponent props={props} colors={colors} />;
    case "AreaChart":
      return <AreaChartComponent props={props} colors={colors} />;
    case "PieChart":
      return <PieChartComponent props={props} colors={colors} />;
    default:
      return null;
  }
}

function waitForRender(): Promise<void> {
  return new Promise((resolve) => {
    // Wait for multiple animation frames + timeout for recharts to fully paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 800);
      });
    });
  });
}

/**
 * Renders each chart slide into a hidden DOM container, captures it as a PNG,
 * and returns a map of slide ID -> base64 data URL.
 */
export async function captureChartImages(
  slides: Slide[]
): Promise<Map<string, string>> {
  const chartSlides = slides.filter((s) => s.chartSpec);
  const images = new Map<string, string>();

  if (chartSlides.length === 0) return images;

  for (const slide of chartSlides) {
    if (!slide.chartSpec) continue;

    // Create a container that is on-screen but invisible so recharts can measure
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "1200px";
    container.style.height = "600px";
    container.style.zIndex = "-1";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";
    container.style.backgroundColor = "#1a1a2e";
    container.style.color = "#e8e8e8";
    container.style.fontFamily = "system-ui, sans-serif";
    document.body.appendChild(container);

    const mountEl = document.createElement("div");
    mountEl.style.width = "1200px";
    mountEl.style.height = "600px";
    mountEl.style.padding = "24px";
    mountEl.style.boxSizing = "border-box";
    container.appendChild(mountEl);

    const chartNode = renderChart(slide.chartSpec, slide.chartColors);
    if (!chartNode) {
      document.body.removeChild(container);
      continue;
    }

    const root = createRoot(mountEl);
    root.render(chartNode);

    await waitForRender();

    try {
      const dataUrl = await toPng(mountEl, {
        width: 1200,
        height: 600,
        pixelRatio: 2,
        backgroundColor: "transparent",
      });
      images.set(slide.id, dataUrl);
    } catch (err) {
      console.error("Failed to capture chart for slide", slide.id, err);
    }

    root.unmount();
    document.body.removeChild(container);
  }

  return images;
}
