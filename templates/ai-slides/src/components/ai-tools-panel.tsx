"use client";

import { useState } from "react";
import {
  Wand2,
  Search,
  ImageIcon,
  Sparkles,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Slide, SlideLayout, SlideTheme } from "@/lib/types";
import type { Model } from "@/hooks/use-models";
import { cn } from "@/lib/utils";

type AIToolsPanelProps = {
  currentSlide: Slide;
  theme: SlideTheme;
  textModel: string;
  imageModel: string;
  searchModel: string;
  textModels: Model[];
  imageModels: Model[];
  searchModels: Model[];
  modelsLoading: boolean;
  onSetTextModel: (model: string) => void;
  onSetImageModel: (model: string) => void;
  onSetSearchModel: (model: string) => void;
  onSetTheme: (theme: SlideTheme) => void;
  onGeneratePresentation: (prompt: string, slideCount: number) => Promise<void>;
  onResearch: (topic: string) => Promise<string>;
  onGenerateImage: (prompt: string) => Promise<void>;
  onEnhanceSlide: (instruction: string, researchContext?: string) => Promise<void>;
  onGenerateChart: (prompt: string) => Promise<void>;
  onChangeLayout: (layout: SlideLayout) => void;
  isGenerating: boolean;
  isResearching: boolean;
  isGeneratingImage: boolean;
  isEnhancing: boolean;
  isGeneratingChart: boolean;
};

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-3.5" />
          {title}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-4 pb-3 space-y-2.5">{children}</div>}
    </div>
  );
}

export function AIToolsPanel({
  currentSlide,
  theme,
  textModel,
  imageModel,
  searchModel,
  textModels,
  imageModels,
  searchModels,
  modelsLoading,
  onSetTextModel,
  onSetImageModel,
  onSetSearchModel,
  onSetTheme,
  onGeneratePresentation,
  onResearch,
  onGenerateImage,
  onEnhanceSlide,
  onGenerateChart,
  onChangeLayout,
  isGenerating,
  isResearching,
  isGeneratingImage,
  isEnhancing,
  isGeneratingChart,
}: AIToolsPanelProps) {
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [slideCount, setSlideCount] = useState(8);
  const [researchTopic, setResearchTopic] = useState("");
  const [researchResult, setResearchResult] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [enhanceInstruction, setEnhanceInstruction] = useState("");
  const [chartPrompt, setChartPrompt] = useState("");

  const searchModelList =
    searchModels.length > 0 ? searchModels : textModels;

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">AI Tools</h2>
      </div>

      <ScrollArea className="flex-1">
        <CollapsibleSection
          title="Generate Presentation"
          icon={Wand2}
          defaultOpen={true}
        >
          <Textarea
            placeholder="Describe your presentation topic..."
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            className="min-h-20 text-xs"
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">
              Slides:
            </Label>
            <Select
              value={String(slideCount)}
              onValueChange={(v) => setSlideCount(Number(v))}
            >
              <SelectTrigger size="sm" className="w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 6, 8, 10, 12, 15].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="w-full text-xs"
            disabled={!generatePrompt.trim() || isGenerating}
            onClick={async () => {
              await onGeneratePresentation(generatePrompt, slideCount);
              setGeneratePrompt("");
            }}
          >
            {isGenerating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Wand2 className="size-3" />
            )}
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </CollapsibleSection>

        <CollapsibleSection title="Research Topic" icon={Search}>
          <Textarea
            placeholder="What topic to research?"
            value={researchTopic}
            onChange={(e) => setResearchTopic(e.target.value)}
            className="min-h-16 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="w-full text-xs"
            disabled={!researchTopic.trim() || isResearching}
            onClick={async () => {
              const result = await onResearch(researchTopic);
              setResearchResult(result);
            }}
          >
            {isResearching ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Search className="size-3" />
            )}
            {isResearching ? "Researching..." : "Research"}
          </Button>
          {researchResult && (
            <div className="rounded-md bg-secondary p-2 text-[11px] text-muted-foreground max-h-48 overflow-y-auto">
              <div className="mb-1 font-medium text-foreground">
                Research Results:
              </div>
              <pre className="whitespace-pre-wrap font-sans">
                {researchResult}
              </pre>
              <Button
                size="xs"
                variant="ghost"
                className="mt-2 text-[10px]"
                disabled={isEnhancing}
                onClick={() => {
                  onEnhanceSlide(
                    "Incorporate the research findings into this slide",
                    researchResult
                  );
                }}
              >
                <Sparkles className="size-2.5" />
                Apply to Current Slide
              </Button>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Generate Image" icon={ImageIcon}>
          <Textarea
            placeholder="Describe the image for this slide..."
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            className="min-h-16 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="w-full text-xs"
            disabled={!imagePrompt.trim() || isGeneratingImage}
            onClick={async () => {
              await onGenerateImage(imagePrompt);
              setImagePrompt("");
            }}
          >
            {isGeneratingImage ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ImageIcon className="size-3" />
            )}
            {isGeneratingImage ? "Generating..." : "Generate Image"}
          </Button>
        </CollapsibleSection>

        <CollapsibleSection title="Enhance Slide" icon={Sparkles}>
          <Textarea
            placeholder="How to improve this slide? e.g., 'Make it more concise', 'Add statistics'..."
            value={enhanceInstruction}
            onChange={(e) => setEnhanceInstruction(e.target.value)}
            className="min-h-16 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="w-full text-xs"
            disabled={!enhanceInstruction.trim() || isEnhancing}
            onClick={async () => {
              await onEnhanceSlide(enhanceInstruction);
              setEnhanceInstruction("");
            }}
          >
            {isEnhancing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {isEnhancing ? "Enhancing..." : "Enhance"}
          </Button>
        </CollapsibleSection>

        <CollapsibleSection title="Add Chart" icon={BarChart3}>
          <Textarea
            placeholder="Describe the chart, e.g., 'Bar chart showing quarterly revenue growth'..."
            value={chartPrompt}
            onChange={(e) => setChartPrompt(e.target.value)}
            className="min-h-16 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            className="w-full text-xs"
            disabled={!chartPrompt.trim() || isGeneratingChart}
            onClick={async () => {
              await onGenerateChart(chartPrompt);
              setChartPrompt("");
            }}
          >
            {isGeneratingChart ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <BarChart3 className="size-3" />
            )}
            {isGeneratingChart ? "Generating..." : "Add Chart"}
          </Button>
        </CollapsibleSection>

        <Separator />

        <div className="px-4 py-3 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">
            Slide Settings
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Layout</Label>
            <Select
              value={currentSlide.layout}
              onValueChange={(v) => onChangeLayout(v as SlideLayout)}
            >
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title Slide</SelectItem>
                <SelectItem value="content">Content</SelectItem>
                <SelectItem value="image-left">Image Left</SelectItem>
                <SelectItem value="image-right">Image Right</SelectItem>
                <SelectItem value="two-column">Two Column</SelectItem>
                <SelectItem value="chart">Chart</SelectItem>
                <SelectItem value="blank">Blank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Palette className="size-3" />
              Theme
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["dark", "light", "blue", "gradient"] as SlideTheme[]).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => onSetTheme(t)}
                    className={cn(
                      "h-8 rounded-md border-2 text-[9px] font-medium transition-colors",
                      t === "dark" && "bg-[#1a1a2e] text-white",
                      t === "light" && "bg-white text-gray-900",
                      t === "blue" &&
                        "bg-gradient-to-br from-[#0f2b46] to-[#1a4a7a] text-white",
                      t === "gradient" &&
                        "bg-gradient-to-br from-[#1e1b4b] to-[#6366f1] text-white",
                      theme === t
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-transparent"
                    )}
                  >
                    {t}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="px-4 py-3 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">
            Models
            {modelsLoading && (
              <Loader2 className="inline-block size-3 animate-spin ml-1.5" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Text Model</Label>
            <Select value={textModel} onValueChange={onSetTextModel}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue placeholder={modelsLoading ? "Loading..." : "Select model"} />
              </SelectTrigger>
              <SelectContent>
                {textModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Search Model</Label>
            <Select value={searchModel} onValueChange={onSetSearchModel}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue placeholder={modelsLoading ? "Loading..." : "Select model"} />
              </SelectTrigger>
              <SelectContent>
                {searchModelList.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Image Model</Label>
            <Select value={imageModel} onValueChange={onSetImageModel}>
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue placeholder={modelsLoading ? "Loading..." : "Select model"} />
              </SelectTrigger>
              <SelectContent>
                {imageModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
