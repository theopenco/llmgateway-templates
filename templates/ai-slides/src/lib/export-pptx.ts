import PptxGenJS from "pptxgenjs";
import type { Presentation, Slide, SlideTheme } from "./types";

const THEME_BG: Record<SlideTheme, string> = {
  dark: "1a1a2e",
  light: "ffffff",
  blue: "0f2b46",
  gradient: "1e1b4b",
};

const THEME_TEXT: Record<SlideTheme, string> = {
  dark: "e8e8e8",
  light: "1a1a2e",
  blue: "ffffff",
  gradient: "ffffff",
};

const THEME_MUTED: Record<SlideTheme, string> = {
  dark: "a0a0b0",
  light: "5a5a6e",
  blue: "94c4f5",
  gradient: "c4b5fd",
};

function addSlideContent(
  pptSlide: PptxGenJS.Slide,
  slide: Slide,
  theme: SlideTheme,
  chartImage?: string
) {
  const textColor = THEME_TEXT[theme];
  const mutedColor = THEME_MUTED[theme];

  switch (slide.layout) {
    case "title":
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 2.0,
        w: 9.0,
        h: 1.5,
        fontSize: 36,
        bold: true,
        color: textColor,
        align: "center",
        valign: "bottom",
      });
      if (slide.subtitle) {
        pptSlide.addText(slide.subtitle, {
          x: 0.5,
          y: 3.5,
          w: 9.0,
          h: 1.0,
          fontSize: 18,
          color: mutedColor,
          align: "center",
          valign: "top",
        });
      }
      break;

    case "content":
    case "blank":
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: textColor,
      });
      if (slide.content) {
        const bullets = slide.content
          .split("\n")
          .filter(Boolean)
          .map((line) => ({
            text: line.replace(/^[-*]\s*/, ""),
            options: {
              bullet: line.match(/^[-*]\s/) ? true : false,
              color: textColor,
              fontSize: 16,
            } as PptxGenJS.TextPropsOptions,
          }));
        pptSlide.addText(bullets, {
          x: 0.5,
          y: 1.3,
          w: 9.0,
          h: 4.5,
          valign: "top",
          paraSpaceAfter: 8,
        });
      }
      break;

    case "image-left":
    case "image-right": {
      const imgLeft = slide.layout === "image-left";
      const imgSize = (slide.imageSize || 40) / 100;
      const contentSize = 1 - imgSize;
      const imgX = imgLeft ? 0.3 : 0.3 + contentSize * 9.4;
      const contentX = imgLeft ? 0.3 + imgSize * 9.4 : 0.3;

      pptSlide.addText(slide.title, {
        x: contentX,
        y: 0.3,
        w: contentSize * 9.4,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: textColor,
      });

      if (slide.content) {
        const bullets = slide.content
          .split("\n")
          .filter(Boolean)
          .map((line) => ({
            text: line.replace(/^[-*]\s*/, ""),
            options: {
              bullet: line.match(/^[-*]\s/) ? true : false,
              color: textColor,
              fontSize: 14,
            } as PptxGenJS.TextPropsOptions,
          }));
        pptSlide.addText(bullets, {
          x: contentX,
          y: 1.3,
          w: contentSize * 9.4,
          h: 4.2,
          valign: "top",
          paraSpaceAfter: 6,
        });
      }

      if (slide.image) {
        pptSlide.addImage({
          data: slide.image,
          x: imgX,
          y: 0.5,
          w: imgSize * 9.4,
          h: 5.0,
          sizing: { type: "contain", w: imgSize * 9.4, h: 5.0 },
        });
      }
      break;
    }

    case "two-column":
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: textColor,
      });
      if (slide.content) {
        const leftBullets = slide.content
          .split("\n")
          .filter(Boolean)
          .map((line) => ({
            text: line.replace(/^[-*]\s*/, ""),
            options: {
              bullet: line.match(/^[-*]\s/) ? true : false,
              color: textColor,
              fontSize: 14,
            } as PptxGenJS.TextPropsOptions,
          }));
        pptSlide.addText(leftBullets, {
          x: 0.5,
          y: 1.3,
          w: 4.2,
          h: 4.5,
          valign: "top",
        });
      }
      if (slide.secondaryContent) {
        const rightBullets = slide.secondaryContent
          .split("\n")
          .filter(Boolean)
          .map((line) => ({
            text: line.replace(/^[-*]\s*/, ""),
            options: {
              bullet: line.match(/^[-*]\s/) ? true : false,
              color: textColor,
              fontSize: 14,
            } as PptxGenJS.TextPropsOptions,
          }));
        pptSlide.addText(rightBullets, {
          x: 5.3,
          y: 1.3,
          w: 4.2,
          h: 4.5,
          valign: "top",
        });
      }
      break;

    case "chart":
      pptSlide.addText(slide.title, {
        x: 0.5,
        y: 0.3,
        w: 9.0,
        h: 0.8,
        fontSize: 24,
        bold: true,
        color: textColor,
      });
      if (chartImage) {
        pptSlide.addImage({
          data: chartImage,
          x: 0.5,
          y: 1.3,
          w: 9.0,
          h: 4.5,
          sizing: { type: "contain", w: 9.0, h: 4.5 },
        });
      }
      break;
  }

  if (slide.speakerNotes) {
    pptSlide.addNotes(slide.speakerNotes);
  }
}

/**
 * Export presentation to PPTX. Charts are passed as pre-rendered images.
 * @param chartImages - Map of slide ID to base64 PNG data URL for chart slides
 */
export async function exportToPptx(
  presentation: Presentation,
  chartImages: Map<string, string>
) {
  const pptx = new PptxGenJS();
  pptx.title = presentation.title;
  pptx.layout = "LAYOUT_WIDE";

  const bgColor = THEME_BG[presentation.theme];

  for (const slide of presentation.slides) {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: bgColor };
    const chartImage = chartImages.get(slide.id);
    addSlideContent(pptSlide, slide, presentation.theme, chartImage);
  }

  await pptx.writeFile({
    fileName: `${presentation.title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "presentation"}.pptx`,
  });
}
