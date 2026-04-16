"use client";

import { Plus, Trash2, GripVertical, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Slide, SlideTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlidePanelProps = {
  slides: Slide[];
  currentIndex: number;
  theme: SlideTheme;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onDuplicate: (index: number) => void;
  onReorder: (from: number, to: number) => void;
};

const themeStyles: Record<SlideTheme, string> = {
  dark: "bg-[#1a1a2e] text-[#e8e8e8]",
  light: "bg-white text-[#1a1a2e]",
  blue: "bg-[#0f2b46] text-white",
  gradient: "bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#6366f1] text-white",
};

function SlideThumbnail({
  slide,
  index,
  theme,
  isActive,
}: {
  slide: Slide;
  index: number;
  theme: SlideTheme;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-sm border-2 transition-colors",
        isActive
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-muted-foreground/30"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col p-2",
          themeStyles[theme]
        )}
      >
        {slide.layout === "title" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="text-[7px] font-bold leading-tight line-clamp-2">
              {slide.title || "Untitled"}
            </div>
            {slide.subtitle && (
              <div className="mt-0.5 text-[5px] opacity-70 line-clamp-1">
                {slide.subtitle}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-[6px] font-bold leading-tight line-clamp-1">
              {slide.title || "Untitled"}
            </div>
            <div className="mt-1 flex-1 text-[4px] leading-tight opacity-70 line-clamp-3">
              {slide.content || "No content"}
            </div>
          </>
        )}
      </div>
      <div className="absolute bottom-0.5 right-1 text-[5px] font-mono opacity-50">
        {index + 1}
      </div>
    </div>
  );
}

export function SlidePanel({
  slides,
  currentIndex,
  theme,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
}: SlidePanelProps) {
  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Slides ({slides.length})
        </span>
        <Button variant="ghost" size="icon-xs" onClick={onAdd}>
          <Plus className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1.5 p-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="group relative cursor-pointer"
              onClick={() => onSelect(index)}
            >
              <SlideThumbnail
                slide={slide}
                index={index}
                theme={theme}
                isActive={index === currentIndex}
              />
              <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(index);
                  }}
                  className="rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
                >
                  <Copy className="size-2.5" />
                </button>
                {slides.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(index);
                    }}
                    className="rounded bg-black/60 p-0.5 text-red-400 hover:bg-black/80"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                )}
              </div>
              <div className="absolute top-1/2 left-0 -translate-y-1/2 opacity-0 group-hover:opacity-50">
                <GripVertical className="size-3 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onAdd}
        >
          <Plus className="size-3" />
          Add Slide
        </Button>
      </div>
    </div>
  );
}
