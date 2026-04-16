"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  GripVertical,
} from "lucide-react";
import {
  BarChartComponent,
  LineChartComponent,
  AreaChartComponent,
  PieChartComponent,
} from "@/components/chart-components";
import type { Slide, SlideTheme, MediaPosition } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlideEditorProps = {
  slide: Slide;
  theme: SlideTheme;
  slideIndex: number;
  totalSlides: number;
  onUpdate: (updates: Partial<Slide>) => void;
};

const themeClasses: Record<SlideTheme, string> = {
  dark: "slide-theme-dark",
  light: "slide-theme-light",
  blue: "slide-theme-blue",
  gradient: "slide-theme-gradient",
};

const themeBg: Record<SlideTheme, string> = {
  dark: "bg-[#1a1a2e]",
  light: "bg-white",
  blue: "bg-gradient-to-br from-[#0f2b46] via-[#1a4a7a] to-[#0d3b66]",
  gradient:
    "bg-gradient-to-br from-[#1e1b4b] via-[#312e81] via-60% to-[#6366f1]",
};

const themeText: Record<SlideTheme, string> = {
  dark: "text-[#e8e8e8]",
  light: "text-[#1a1a2e]",
  blue: "text-white",
  gradient: "text-white",
};

const themeMuted: Record<SlideTheme, string> = {
  dark: "text-[#a0a0b0]",
  light: "text-[#5a5a6e]",
  blue: "text-[#94c4f5]",
  gradient: "text-[#c4b5fd]",
};

const CHART_PRESETS = [
  { name: "Default", colors: ["#2563eb", "#16a34a", "#eab308", "#9333ea", "#e11d48"] },
  { name: "Ocean", colors: ["#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#34d399"] },
  { name: "Sunset", colors: ["#f97316", "#ef4444", "#ec4899", "#f59e0b", "#eab308"] },
  { name: "Neon", colors: ["#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#22d3ee"] },
  { name: "Earth", colors: ["#92400e", "#b45309", "#a16207", "#4d7c0f", "#166534"] },
  { name: "Pastel", colors: ["#93c5fd", "#86efac", "#fde68a", "#c4b5fd", "#fda4af"] },
];

function EditableText({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const save = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className={cn(
            "w-full resize-none rounded bg-black/20 p-1 outline-none ring-1 ring-white/20",
            className
          )}
          autoFocus
          rows={Math.max(3, draft.split("\n").length)}
        />
      );
    }
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className={cn(
          "w-full rounded bg-black/20 p-1 outline-none ring-1 ring-white/20",
          className
        )}
        autoFocus
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        "cursor-text rounded px-1 transition-colors hover:bg-white/5",
        !value && "opacity-40 italic",
        className
      )}
    >
      {value || placeholder || "Click to edit"}
    </div>
  );
}

function ContentRenderer({
  content,
  onChange,
  className,
}: {
  content: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  const startEdit = () => {
    setDraft(content);
    setEditing(true);
  };

  const save = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        className={cn(
          "w-full resize-none rounded bg-black/20 p-2 text-sm outline-none ring-1 ring-white/20",
          className
        )}
        autoFocus
        rows={Math.max(5, draft.split("\n").length + 1)}
      />
    );
  }

  const lines = content.split("\n").filter(Boolean);
  return (
    <div
      onClick={startEdit}
      className={cn(
        "cursor-text rounded px-1 transition-colors hover:bg-white/5",
        className
      )}
    >
      {lines.length > 0 ? (
        <ul className="space-y-1.5">
          {lines.map((line, i) => {
            const text = line.replace(/^[-*]\s*/, "");
            const isBullet = line.match(/^[-*]\s/);
            return (
              <li key={i} className={cn(isBullet && "flex items-start gap-2")}>
                {isBullet && (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current opacity-60" />
                )}
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <span className="opacity-40 italic">Click to add content</span>
      )}
    </div>
  );
}

function MediaPositionControls({
  position,
  onChange,
}: {
  position: MediaPosition;
  onChange: (pos: MediaPosition) => void;
}) {
  return (
    <div className="absolute top-1 right-1 flex gap-0.5 rounded bg-black/60 p-0.5 opacity-0 transition-opacity group-hover/media:opacity-100 z-10">
      <button
        onClick={(e) => { e.stopPropagation(); onChange("left"); }}
        className={cn("rounded p-1 hover:bg-white/20", position === "left" && "bg-white/20")}
        title="Position left"
      >
        <ArrowLeft className="size-3 text-white" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onChange("full"); }}
        className={cn("rounded p-1 hover:bg-white/20", position === "full" && "bg-white/20")}
        title="Full width"
      >
        <Maximize2 className="size-3 text-white" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onChange("right"); }}
        className={cn("rounded p-1 hover:bg-white/20", position === "right" && "bg-white/20")}
        title="Position right"
      >
        <ArrowRight className="size-3 text-white" />
      </button>
    </div>
  );
}

function ResizableMedia({
  children,
  size,
  onResize,
  position,
  onPositionChange,
  side,
}: {
  children: React.ReactNode;
  size: number;
  onResize: (size: number) => void;
  position: MediaPosition;
  onPositionChange: (pos: MediaPosition) => void;
  side: "left" | "right";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startSize = size;
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragging.current) return;
        const delta = e.clientX - startX;
        const deltaPercent = (delta / containerWidth) * 100;
        const newSize = Math.min(
          70,
          Math.max(20, side === "left" ? startSize + deltaPercent : startSize - deltaPercent)
        );
        onResize(Math.round(newSize));
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [size, onResize, side]
  );

  if (position === "full") {
    return (
      <div className="group/media relative w-full">
        <MediaPositionControls position={position} onChange={onPositionChange} />
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="group/media relative shrink-0"
      style={{ width: `${size}%` }}
    >
      <MediaPositionControls position={position} onChange={onPositionChange} />
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center opacity-0 transition-opacity group-hover/media:opacity-100 z-10",
          side === "left" ? "right-0" : "left-0"
        )}
      >
        <GripVertical className="size-4 text-white/60" />
      </div>
    </div>
  );
}

function ChartSlideContent({
  chartSpec,
  colors,
}: {
  chartSpec: Record<string, unknown>;
  colors?: string[];
}) {
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
      return (
        <div className="text-sm opacity-50">
          Unknown chart type: {element.type}
        </div>
      );
  }
}

function ChartColorPicker({
  colors,
  onColorsChange,
  theme,
}: {
  colors?: string[];
  onColorsChange: (colors: string[]) => void;
  theme: SlideTheme;
}) {
  const currentPreset = CHART_PRESETS.find(
    (p) => JSON.stringify(p.colors) === JSON.stringify(colors)
  );

  return (
    <div className="absolute bottom-1 left-1 opacity-0 transition-opacity group-hover/media:opacity-100 z-10">
      <div className="flex gap-1 rounded-lg bg-black/70 backdrop-blur-sm p-1.5">
        {CHART_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={(e) => {
              e.stopPropagation();
              onColorsChange(preset.colors);
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-2 py-1 hover:bg-white/15 transition-colors",
              currentPreset?.name === preset.name && "bg-white/20 ring-1 ring-white/30"
            )}
            title={preset.name}
          >
            <div
              className="h-3 w-10 rounded-sm"
              style={{
                background: `linear-gradient(to right, ${preset.colors.slice(0, 4).join(", ")})`,
              }}
            />
            <span className="text-[8px] text-white/70 leading-none">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MediaWithContent({
  slide,
  theme,
  onUpdate,
  mediaType,
}: {
  slide: Slide;
  theme: SlideTheme;
  onUpdate: (updates: Partial<Slide>) => void;
  mediaType: "image" | "chart";
}) {
  const isImage = mediaType === "image";
  const position = isImage
    ? slide.imagePosition || "right"
    : slide.chartPosition || "full";
  const size = slide.imageSize || 40;

  const mediaContent = isImage ? (
    slide.image ? (
      /* eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not optimizable */
        <img
        src={slide.image}
        alt="Slide image"
          className="max-h-full max-w-full rounded-lg object-cover"
        />
    ) : (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-current/20">
        <span className="text-xs opacity-40">Generate an image</span>
      </div>
    )
  ) : (
    <div className="relative h-full w-full group/media">
      {slide.chartSpec ? (
        <>
          <ChartSlideContent
            chartSpec={slide.chartSpec}
            colors={slide.chartColors}
          />
          <ChartColorPicker
            colors={slide.chartColors}
            onColorsChange={(chartColors) => onUpdate({ chartColors })}
            theme={theme}
          />
        </>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-current/20">
          <span className="text-sm opacity-40">Use AI Tools to generate a chart</span>
        </div>
      )}
    </div>
  );

  const positionKey = isImage ? "imagePosition" : "chartPosition";
  const handlePositionChange = (pos: MediaPosition) =>
    onUpdate({ [positionKey]: pos });
  const handleResize = (newSize: number) => onUpdate({ imageSize: newSize });

  if (position === "full") {
    return (
      <>
        <EditableText
          value={slide.title}
          onChange={(title) => onUpdate({ title })}
          className="mb-4 text-xl font-bold md:text-2xl shrink-0"
          placeholder="Slide Title"
        />
        <div className="group/media relative flex-1 flex items-center justify-center min-h-0">
          <MediaPositionControls
            position={position}
            onChange={handlePositionChange}
          />
          {!isImage && slide.chartSpec && (
            <ChartColorPicker
              colors={slide.chartColors}
              onColorsChange={(chartColors) => onUpdate({ chartColors })}
              theme={theme}
            />
          )}
          {isImage && slide.image ? (
            /* eslint-disable-next-line @next/next/no-img-element -- base64 data URL, not optimizable */
              <img
              src={slide.image}
              alt="Slide image"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
          ) : isImage ? (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-current/20">
              <span className="text-xs opacity-40">Generate an image</span>
            </div>
          ) : (
            slide.chartSpec && (
              <ChartSlideContent
                chartSpec={slide.chartSpec}
                colors={slide.chartColors}
              />
            )
          )}
        </div>
      </>
    );
  }

  const isLeft = position === "left";

  return (
    <>
      <EditableText
        value={slide.title}
        onChange={(title) => onUpdate({ title })}
        className="mb-4 text-xl font-bold md:text-2xl shrink-0"
        placeholder="Slide Title"
      />
      <div
        className={cn(
          "flex flex-1 gap-4 min-h-0",
          isLeft ? "flex-row" : "flex-row-reverse"
        )}
      >
        <ResizableMedia
          size={size}
          onResize={handleResize}
          position={position}
          onPositionChange={handlePositionChange}
          side={isLeft ? "left" : "right"}
        >
          <div className="flex h-full items-center justify-center">
            {mediaContent}
          </div>
        </ResizableMedia>
        <div className="flex flex-1 flex-col min-w-0">
          <ContentRenderer
            content={slide.content}
            onChange={(content) => onUpdate({ content })}
            className="flex-1 text-sm md:text-base"
          />
        </div>
      </div>
    </>
  );
}

export function SlideEditor({
  slide,
  theme,
  slideIndex,
  totalSlides,
  onUpdate,
}: SlideEditorProps) {
  const hasImage = !!slide.image;
  const hasChart = !!slide.chartSpec;

  // Determine what to render based on layout + media presence
  const showImageLayout =
    slide.layout === "image-left" || slide.layout === "image-right" || hasImage;
  const showChartLayout = slide.layout === "chart" || hasChart;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background p-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Slide {slideIndex + 1} of {totalSlides}
        </span>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
          {slide.layout}
        </span>
      </div>

      <div
        className={cn(
          "relative aspect-video w-full max-w-4xl overflow-hidden rounded-lg shadow-2xl",
          themeClasses[theme],
          themeBg[theme],
          themeText[theme]
        )}
      >
        <div className="absolute inset-0 flex flex-col p-8 md:p-12">
          {slide.layout === "title" && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <EditableText
                value={slide.title}
                onChange={(title) => onUpdate({ title })}
                className="text-2xl font-bold md:text-4xl"
                placeholder="Presentation Title"
              />
              <EditableText
                value={slide.subtitle || ""}
                onChange={(subtitle) => onUpdate({ subtitle })}
                className={cn("mt-4 text-base md:text-xl", themeMuted[theme])}
                placeholder="Subtitle"
              />
            </div>
          )}

          {slide.layout === "content" && !showImageLayout && !showChartLayout && (
            <>
              <EditableText
                value={slide.title}
                onChange={(title) => onUpdate({ title })}
                className="mb-6 text-xl font-bold md:text-3xl"
                placeholder="Slide Title"
              />
              <ContentRenderer
                content={slide.content}
                onChange={(content) => onUpdate({ content })}
                className="flex-1 text-sm md:text-lg"
              />
            </>
          )}

          {/* Content + Image: flexible positioning */}
          {slide.layout !== "title" &&
            slide.layout !== "two-column" &&
            showImageLayout &&
            !showChartLayout && (
              <MediaWithContent
                slide={slide}
                theme={theme}
                onUpdate={onUpdate}
                mediaType="image"
              />
            )}

          {/* Content + Chart: flexible positioning */}
          {slide.layout !== "title" &&
            slide.layout !== "two-column" &&
            showChartLayout && (
              <MediaWithContent
                slide={slide}
                theme={theme}
                onUpdate={onUpdate}
                mediaType="chart"
              />
            )}

          {slide.layout === "two-column" && (
            <>
              <EditableText
                value={slide.title}
                onChange={(title) => onUpdate({ title })}
                className="mb-6 text-xl font-bold md:text-3xl"
                placeholder="Slide Title"
              />
              <div className="flex flex-1 gap-6">
                <ContentRenderer
                  content={slide.content}
                  onChange={(content) => onUpdate({ content })}
                  className="w-1/2 text-sm md:text-base"
                />
                <div className="w-px bg-current opacity-10" />
                <ContentRenderer
                  content={slide.secondaryContent || ""}
                  onChange={(secondaryContent) =>
                    onUpdate({ secondaryContent })
                  }
                  className="w-1/2 text-sm md:text-base"
                />
              </div>
            </>
          )}

          {slide.layout === "blank" && !showImageLayout && !showChartLayout && (
            <div className="flex flex-1 flex-col">
              <EditableText
                value={slide.title}
                onChange={(title) => onUpdate({ title })}
                className="mb-4 text-xl font-bold md:text-2xl"
                placeholder="Slide Title"
              />
              <ContentRenderer
                content={slide.content}
                onChange={(content) => onUpdate({ content })}
                className="flex-1 text-sm md:text-base"
              />
            </div>
          )}
        </div>
      </div>

      {slide.speakerNotes && (
        <div className="mt-4 w-full max-w-4xl rounded-lg border border-border bg-card p-4">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Speaker Notes
          </div>
          <EditableText
            value={slide.speakerNotes}
            onChange={(speakerNotes) => onUpdate({ speakerNotes })}
            className="text-xs text-muted-foreground"
            multiline
          />
        </div>
      )}
    </div>
  );
}