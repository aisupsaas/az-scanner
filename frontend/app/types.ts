export type ScreenMode = "start" | "review" | "result";
export type ResultTab = "text" | "compare";
export type CompareView = "split" | "original" | "cleaned";

export type ProcessResponse = {
  success?: boolean;
  text?: string;
  confidence?: number;
  qualityScore?: number;
  usableText?: boolean;
  warning?: string;
  files?: {
    cleanedImageUrl?: string;
    pdfUrl?: string;
    txtUrl?: string;
  };
  error?: string;
};