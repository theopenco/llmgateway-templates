export type SlideLayout =
  | "title"
  | "content"
  | "image-left"
  | "image-right"
  | "two-column"
  | "chart"
  | "blank";

export type MediaPosition = "left" | "right" | "full";

export type Slide = {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content: string;
  secondaryContent?: string;
  image?: string;
  imagePosition?: MediaPosition;
  imageSize?: number; // percentage width 20-80
  chartSpec?: Record<string, unknown>;
  chartPosition?: MediaPosition;
  chartColors?: string[];
  speakerNotes?: string;
};

export type SlideTheme = "dark" | "light" | "blue" | "gradient";

export type Presentation = {
  title: string;
  slides: Slide[];
  theme: SlideTheme;
};
