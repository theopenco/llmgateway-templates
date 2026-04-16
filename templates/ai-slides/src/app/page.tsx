"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { Download, KeyRound, Loader2, Presentation as PresentationIcon } from "lucide-react";
import { useApiKey } from "@/components/api-key-provider";
import { useModels } from "@/hooks/use-models";
import { SlidePanel } from "@/components/slide-panel";
import { SlideEditor } from "@/components/slide-editor";
import { AIToolsPanel } from "@/components/ai-tools-panel";
import { Button } from "@/components/ui/button";
import { exportToPptx } from "@/lib/export-pptx";
import { captureChartImages } from "@/lib/capture-charts";
import type { Presentation, Slide, SlideLayout, SlideTheme } from "@/lib/types";
import { addToast } from "@/hooks/use-toast";

function createSlide(overrides?: Partial<Slide>): Slide {
  return {
    id: nanoid(),
    layout: "content",
    title: "",
    content: "",
    ...overrides,
  };
}

const defaultPresentation: Presentation = {
  title: "Untitled Presentation",
  slides: [
    createSlide({
      layout: "title",
      title: "Your Presentation Title",
      subtitle: "Use AI Tools to generate your slides",
    }),
  ],
  theme: "dark",
};

export default function SlidesPage() {
  const { apiKey, setOpen } = useApiKey();
  const { textModels, imageModels, searchModels, isLoading: modelsLoading } = useModels(apiKey);
  const [presentation, setPresentation] =
    useState<Presentation>(defaultPresentation);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textModel, setTextModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [searchModel, setSearchModel] = useState("");

  // Auto-select first model when lists load
  useEffect(() => {
    if (!textModel && textModels.length > 0) setTextModel(textModels[0].id);
  }, [textModel, textModels]);
  useEffect(() => {
    if (!imageModel && imageModels.length > 0) setImageModel(imageModels[0].id);
  }, [imageModel, imageModels]);
  useEffect(() => {
    if (!searchModel && searchModels.length > 0) setSearchModel(searchModels[0].id);
    else if (!searchModel && textModels.length > 0) setSearchModel(textModels[0].id);
  }, [searchModel, searchModels, textModels]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGeneratingChart, setIsGeneratingChart] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      h["x-api-key"] = apiKey;
    }
    return h;
  }, [apiKey]);

  const currentSlide = presentation.slides[currentIndex];

  const updateSlide = useCallback(
    (index: number, updates: Partial<Slide>) => {
      setPresentation((prev) => ({
        ...prev,
        slides: prev.slides.map((slide, i) =>
          i === index ? { ...slide, ...updates } : slide
        ),
      }));
    },
    []
  );

  const addSlide = useCallback(() => {
    const newSlide = createSlide();
    setPresentation((prev) => {
      const newSlides = [...prev.slides];
      newSlides.splice(currentIndex + 1, 0, newSlide);
      return { ...prev, slides: newSlides };
    });
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex]);

  const deleteSlide = useCallback(
    (index: number) => {
      if (presentation.slides.length <= 1) return;
      setPresentation((prev) => ({
        ...prev,
        slides: prev.slides.filter((_, i) => i !== index),
      }));
      if (currentIndex >= index && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    },
    [currentIndex, presentation.slides.length]
  );

  const duplicateSlide = useCallback(
    (index: number) => {
      const source = presentation.slides[index];
      const duplicate = createSlide({ ...source, id: nanoid() });
      setPresentation((prev) => {
        const newSlides = [...prev.slides];
        newSlides.splice(index + 1, 0, duplicate);
        return { ...prev, slides: newSlides };
      });
      setCurrentIndex(index + 1);
    },
    [presentation.slides]
  );

  const reorderSlides = useCallback((from: number, to: number) => {
    setPresentation((prev) => {
      const newSlides = [...prev.slides];
      const [moved] = newSlides.splice(from, 1);
      newSlides.splice(to, 0, moved);
      return { ...prev, slides: newSlides };
    });
    setCurrentIndex(to);
  }, []);

  const handleGeneratePresentation = useCallback(
    async (prompt: string, slideCount: number) => {
      setIsGenerating(true);
      try {
        const response = await fetch("/api/generate-slides", {
          method: "POST",
          headers,
          body: JSON.stringify({ prompt, model: textModel, slideCount }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to generate");
        }

        const data = await response.json();
        const slides: Slide[] = data.slides.map(
          (s: Omit<Slide, "id">) =>
            createSlide(s)
        );

        setPresentation({
          title: data.title,
          slides,
          theme: presentation.theme,
        });
        setCurrentIndex(0);
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Failed to generate presentation");
      } finally {
        setIsGenerating(false);
      }
    },
    [headers, textModel, presentation.theme]
  );

  const handleResearch = useCallback(
    async (topic: string): Promise<string> => {
      setIsResearching(true);
      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers,
          body: JSON.stringify({ topic, model: searchModel }),
        });

        if (!response.ok) {
          throw new Error("Research failed");
        }

        const data = await response.json();
        return data.research;
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Research failed");
        return "";
      } finally {
        setIsResearching(false);
      }
    },
    [headers, searchModel]
  );

  const handleGenerateImage = useCallback(
    async (prompt: string) => {
      setIsGeneratingImage(true);
      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers,
          body: JSON.stringify({ prompt, model: imageModel }),
        });

        if (!response.ok) {
          throw new Error("Image generation failed");
        }

        const data = await response.json();
        updateSlide(currentIndex, { image: data.image });

        if (
          currentSlide.layout !== "image-left" &&
          currentSlide.layout !== "image-right"
        ) {
          updateSlide(currentIndex, {
            image: data.image,
            layout: "image-right",
          });
        }
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Image generation failed");
      } finally {
        setIsGeneratingImage(false);
      }
    },
    [headers, imageModel, currentIndex, currentSlide?.layout, updateSlide]
  );

  const handleEnhanceSlide = useCallback(
    async (instruction: string, researchContext?: string) => {
      setIsEnhancing(true);
      try {
        const response = await fetch("/api/enhance-slide", {
          method: "POST",
          headers,
          body: JSON.stringify({
            slide: currentSlide,
            instruction,
            model: textModel,
            researchContext,
          }),
        });

        if (!response.ok) {
          throw new Error("Enhancement failed");
        }

        const data = await response.json();
        updateSlide(currentIndex, {
          title: data.title,
          content: data.content,
          subtitle: data.subtitle,
          speakerNotes: data.speakerNotes,
        });
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Slide enhancement failed");
      } finally {
        setIsEnhancing(false);
      }
    },
    [headers, textModel, currentSlide, currentIndex, updateSlide]
  );

  const handleGenerateChart = useCallback(
    async (prompt: string) => {
      setIsGeneratingChart(true);
      try {
        const response = await fetch("/api/generate-chart", {
          method: "POST",
          headers,
          body: JSON.stringify({ prompt, model: textModel, searchModel }),
        });

        if (!response.ok) {
          throw new Error("Chart generation failed");
        }

        const data = await response.json();
        updateSlide(currentIndex, {
          chartSpec: data,
          layout: "chart",
        });
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Chart generation failed");
      } finally {
        setIsGeneratingChart(false);
      }
    },
    [headers, textModel, searchModel, currentIndex, updateSlide]
  );

  const handleChangeLayout = useCallback(
    (layout: SlideLayout) => {
      updateSlide(currentIndex, { layout });
    },
    [currentIndex, updateSlide]
  );

  if (!currentSlide) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <PresentationIcon className="size-5 text-primary" />
          <input
            value={presentation.title}
            onChange={(e) =>
              setPresentation((prev) => ({ ...prev, title: e.target.value }))
            }
            className="bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground focus:ring-0"
            placeholder="Untitled Presentation"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true);
              try {
                const chartImages = await captureChartImages(presentation.slides);
                await exportToPptx(presentation, chartImages);
              } catch (error) {
                addToast(error instanceof Error ? error.message : "Export failed");
              } finally {
                setIsExporting(false);
              }
            }}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span className="text-xs">Export PPT</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            <KeyRound className="size-3.5" />
            <span className="text-xs">API Key</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <SlidePanel
          slides={presentation.slides}
          currentIndex={currentIndex}
          theme={presentation.theme}
          onSelect={setCurrentIndex}
          onAdd={addSlide}
          onDelete={deleteSlide}
          onDuplicate={duplicateSlide}
          onReorder={reorderSlides}
        />

        <SlideEditor
          slide={currentSlide}
          theme={presentation.theme}
          slideIndex={currentIndex}
          totalSlides={presentation.slides.length}
          onUpdate={(updates) => updateSlide(currentIndex, updates)}
        />

        <AIToolsPanel
          currentSlide={currentSlide}
          theme={presentation.theme}
          textModel={textModel}
          imageModel={imageModel}
          searchModel={searchModel}
          textModels={textModels}
          imageModels={imageModels}
          searchModels={searchModels}
          modelsLoading={modelsLoading}
          onSetTextModel={setTextModel}
          onSetImageModel={setImageModel}
          onSetSearchModel={setSearchModel}
          onSetTheme={(theme) =>
            setPresentation((prev) => ({ ...prev, theme }))
          }
          onGeneratePresentation={handleGeneratePresentation}
          onResearch={handleResearch}
          onGenerateImage={handleGenerateImage}
          onEnhanceSlide={handleEnhanceSlide}
          onGenerateChart={handleGenerateChart}
          onChangeLayout={handleChangeLayout}
          isGenerating={isGenerating}
          isResearching={isResearching}
          isGeneratingImage={isGeneratingImage}
          isEnhancing={isEnhancing}
          isGeneratingChart={isGeneratingChart}
        />
      </div>
    </div>
  );
}