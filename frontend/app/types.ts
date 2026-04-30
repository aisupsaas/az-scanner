export type ScreenMode = "start" | "review" | "result";
export type ResultTab = "text" | "compare";
export type CompareView = "split" | "original" | "cleaned";

export type OcrLine = {
  id: string;
  text: string;
  confidence?: number;
  bbox?: {
    x0?: number;
    y0?: number;
    x1?: number;
    y1?: number;
  } | null;
};

export type ImageEditSettings = {
  pdfSource: "original" | "cleaned";
  rotate: 0 | 90 | 180 | 270;
  brightness: number;
  crop: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

export type ProcessResponse = {
  success?: boolean;
  text?: string;
  confidence?: number;
  qualityScore?: number;
  usableText?: boolean;
  warning?: string;
  lineCount?: number;
  lines?: OcrLine[];
  files?: {
    originalPdfImageUrl?: string;
    cleanedImageUrl?: string;
    pdfUrl?: string;
    txtUrl?: string;
  };
  error?: string;
};