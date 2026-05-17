"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import type {
  CompareView,
  ImageEditSettings,
  OcrLine,
  PlanType,
  ProcessResponse,
  ResultTab,
  ScreenMode,
} from "./types";
import {
  cleanStandardText,
  mergeLines,
  normalizeSpacing,
  removeExtraBlankLines,
} from "./utils/textTools";
import {
  downloadBlobFile,
  downloadTextFile,
  shareBlobFile,
  shareTextFile,
} from "./utils/downloads";
import StartScreen from "./components/StartScreen";
import ReviewScreen from "./components/ReviewScreen";
import ResultScreen from "./components/ResultScreen";
import CameraOverlay from "./components/CameraOverlay";
import BottomBar from "./components/BottomBar";

const STANDARD_MAX_IMAGES = 10;
const PRO_BATCH_LIMIT = 20;

const DEFAULT_IMAGE_EDIT: ImageEditSettings = {
  pdfSource: "original",
  smartCleanMode: "color",
  rotate: 0,
  brightness: 1,
  zoom: 1,
  panX: 0,
  panY: 0,
  crop: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  applied: false,
};

function makeDefaultEdits(count: number) {
  return Array.from({ length: count }, () => ({ ...DEFAULT_IMAGE_EDIT, crop: { ...DEFAULT_IMAGE_EDIT.crop } }));
}

function linesToText(lines: OcrLine[]) {
  return lines
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join("\n");
}

type ExportAction = {
  title: string;
  defaultName: string;
  run: (filenameBase: string) => void | Promise<void>;
};

type HistoryItem = {
  id: string;
  title: string;
  createdAt: string;
  pageCount: number;
  text: string;
  projectData?: any | null;
  storageBytes?: number;
};

type StorageUsage = {
  privateUsedBytes: number;
  privateLimitBytes: number;
  shareUsedBytes: number;
  shareLimitBytes: number;
};

type ShareMember = {
  id: string;
  sharedProjectId: string;
  memberEmail: string;
  canView: boolean;
  canDownload: boolean;
  canPrint: boolean;
  canReshare: boolean;
};

type SharedProjectItem = {
  id: string;
  title: string;
  createdAt: string;
  storageBytes: number;
  projectData: any | null;
  members: ShareMember[];
};

type SharedWithMeItem = {
  id: string;
  title: string;
  createdAt: string;
  ownerId: string;
  storageBytes: number;
  projectData: any | null;
  canDownload: boolean;
  canPrint: boolean;
  canReshare: boolean;
};

type DrawerSection =
  | "account"
  | "private"
  | "share"
  | "sharedWithMe"
  | "settings"
  | "help";

export default function HomePage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
    []
  );

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return null;

    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);

  const [mode, setMode] = useState<ScreenMode>("start");
  const [resultTab, setResultTab] = useState<ResultTab>("text");
  const [compareView, setCompareView] = useState<CompareView>("split");

  const [files, setFiles] = useState<File[]>([]);
  const [sourcePreviews, setSourcePreviews] = useState<string[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedLines, setEditedLines] = useState<OcrLine[]>([]);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [originalOcrText, setOriginalOcrText] = useState("");
  const [originalOcrLines, setOriginalOcrLines] = useState<OcrLine[]>([]);
  const [textHistory, setTextHistory] = useState<string[]>([]);
  const [imageEdits, setImageEdits] = useState<ImageEditSettings[]>([]);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("Ready to scan or upload.");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("standard");

  const [applyAllModalOpen, setApplyAllModalOpen] = useState(false);
  
  const [exportAction, setExportAction] = useState<ExportAction | null>(null);
  const [exportFilename, setExportFilename] = useState("az-scanner-document");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<"menu" | "section">("menu");
  const [activeDrawerSection, setActiveDrawerSection] = useState<DrawerSection>("private");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [sharedProjects, setSharedProjects] = useState<SharedProjectItem[]>([]);
  const [sharedWithMeItems, setSharedWithMeItems] = useState<SharedWithMeItem[]>([]);
  const [shareEmailDrafts, setShareEmailDrafts] = useState<Record<string, string>>({});
  const [previewProject, setPreviewProject] = useState<{
    title: string;
    subtitle: string;
    projectData: any | null;
    storageBytes: number;
    source: "private" | "share" | "sharedWithMe";
    canDownload?: boolean;
  } | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({
    privateUsedBytes: 0,
    privateLimitBytes: 1073741824,
    shareUsedBytes: 0,
    shareLimitBytes: 1073741824,
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  
  const originalImageUrls =
    result?.files?.originalPdfImageUrls?.map((url) => `${apiBase}${url}`) ||
    (result?.files?.originalPdfImageUrl ? [`${apiBase}${result.files.originalPdfImageUrl}`] : []);

  const cleanedImageUrls =
    result?.files?.cleanedImageUrls?.map((url) => `${apiBase}${url}`) ||
    (result?.files?.cleanedImageUrl ? [`${apiBase}${result.files.cleanedImageUrl}`] : []);

const rawSmartCleanImageUrls = result?.files?.smartCleanImageUrls || [];

const smartCleanColorImageUrls = rawSmartCleanImageUrls.map((item: any) => {
  if (typeof item === "string") return `${apiBase}${item}`;
  return item?.color ? `${apiBase}${item.color}` : "";
});

const smartCleanBwImageUrls = rawSmartCleanImageUrls.map((item: any) => {
  if (typeof item === "string") return `${apiBase}${item}`;
  return item?.bw ? `${apiBase}${item.bw}` : "";
});

const smartCleanImageUrls =
  smartCleanColorImageUrls.length
    ? smartCleanColorImageUrls
    : result?.files?.smartCleanImageUrl
      ? [`${apiBase}${result.files.smartCleanImageUrl}`]
      : [];
      
  const originalImageHref =
    originalImageUrls[activePageIndex] || sourcePreviews[activePageIndex] || "";

  const cleanedImageHref = cleanedImageUrls[activePageIndex] || "";

  const smartCleanImageHref = smartCleanImageUrls[activePageIndex] || "";
  const smartCleanColorImageHref = smartCleanColorImageUrls[activePageIndex] || smartCleanImageHref;
  const smartCleanBwImageHref = smartCleanBwImageUrls[activePageIndex] || smartCleanImageHref;

  const activeImageEdit = imageEdits[activePageIndex] || DEFAULT_IMAGE_EDIT;

  const topTitle =
    mode === "start" ? "Start" : mode === "review" ? "Review" : "Result";

  const sharedWithMeUserCount = useMemo(() => {
    return new Set(sharedWithMeItems.map((item) => item.ownerId)).size;
  }, [sharedWithMeItems]);

  function revokeSourcePreviews() {
    setSourcePreviews((prev) => {
      for (const url of prev) URL.revokeObjectURL(url);
      return [];
    });
  }

  function stopCameraStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }

    if (videoRef.current) videoRef.current.srcObject = null;

    setCameraReady(false);
    setCameraLoading(false);
  }

  function clearAll() {
    setFiles([]);
    setResult(null);
    setEditedText("");
    setEditedLines([]);
    setPageTexts([]);
    setImageEdits([]);
    setOriginalOcrText("");
    setOriginalOcrLines([]);
    setTextHistory([]);
    setActivePageIndex(0);
    setError("");
    setLoading(false);
    setStatusText("Ready to scan or upload.");
    setMode("start");
    setResultTab("text");
    setCompareView("split");
    revokeSourcePreviews();
  }

  function addFiles(nextInput: FileList | File[] | File | null) {
  if (!nextInput) return;

  const incoming =
    nextInput instanceof File
      ? [nextInput]
      : Array.isArray(nextInput)
        ? nextInput
        : Array.from(nextInput);

  const images = incoming.filter((item) => item.type.startsWith("image/"));

  if (!images.length) {
    setError("Only image files are allowed.");
    return;
  }

  setError("");
  setResult(null);
  setEditedText("");
  setEditedLines([]);
  setResultTab("text");
  setCompareView("split");

  setFiles((current) => {
    let nextImages = images;

    // 🚫 PRO batch limit (per selection)
    if (selectedPlan === "pro" && images.length > PRO_BATCH_LIMIT) {
      nextImages = images.slice(0, PRO_BATCH_LIMIT);
     setError('You can add only up to 20 files at once. Tap "Add files" again if needed.');
    }

    let merged = [...current, ...nextImages];

    // 🚫 STANDARD total limit
    if (selectedPlan === "standard" && merged.length > STANDARD_MAX_IMAGES) {
      merged = merged.slice(0, STANDARD_MAX_IMAGES);
      setError("Maximum 10 images allowed in Standard plan.");
    }

    const nextPreviews = merged.map((file) => URL.createObjectURL(file));

    setSourcePreviews((prev) => {
      for (const url of prev) URL.revokeObjectURL(url);
      return nextPreviews;
    });

    setImageEdits(makeDefaultEdits(merged.length));
    setActivePageIndex(Math.max(0, merged.length - nextImages.length));
    setStatusText(`${merged.length} image${merged.length === 1 ? "" : "s"} ready.`);
    setMode("review");

    return merged;
  });
}

  function removePage(index: number) {
    setFiles((current) => {
      const next = current.filter((_, i) => i !== index);
      const nextPreviews = next.map((file) => URL.createObjectURL(file));

      setSourcePreviews((prev) => {
        for (const url of prev) URL.revokeObjectURL(url);
        return nextPreviews;
      });

      setImageEdits(makeDefaultEdits(next.length));
      setActivePageIndex(Math.max(0, Math.min(index, next.length - 1)));
      setStatusText(next.length ? `${next.length} image${next.length === 1 ? "" : "s"} ready.` : "Ready to scan or upload.");

      if (!next.length) {
        setMode("start");
      }

      return next;
    });
  }

 function movePage(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || toIndex < 0) return;

  setFiles((currentFiles) => {
    if (fromIndex >= currentFiles.length || toIndex >= currentFiles.length) {
      return currentFiles;
    }

    const moveItem = <T,>(items: T[]) => {
      const next = [...items];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    };

    const nextFiles = moveItem(currentFiles);

    setSourcePreviews((currentPreviews) => {
      for (const url of currentPreviews) URL.revokeObjectURL(url);
      return nextFiles.map((file) => URL.createObjectURL(file));
    });

    setImageEdits((current) => moveItem(current));

    setActivePageIndex(toIndex);
    setStatusText(`Moved page ${fromIndex + 1} to position ${toIndex + 1}.`);

    return nextFiles;
  });
}

  function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });
}

function compressImageForOcr(file: File): Promise<File> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);

      const maxSide = 2400;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.94
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    image.src = url;
  });
}

  async function processSelectedFiles() {
  if (!files.length) {
    setError("Please choose an image first.");
    return;
  }

  setLoading(true);
  setError("");
  setResult(null);
  setEditedText("");
  setEditedLines([]);
  setStatusText(
    selectedPlan === "pro"
      ? `Preparing ${files.length} page${files.length === 1 ? "" : "s"} for Pro OCR...`
      : `Preparing ${files.length} image${files.length === 1 ? "" : "s"}...`
  );
  setMode("review");

  try {
    const compressedBase64Files = await Promise.all(
      files.map(async (file, index) => {
        setStatusText(
          selectedPlan === "pro"
            ? `Preparing page ${index + 1} of ${files.length} for upload...`
            : `Preparing image ${index + 1} of ${files.length}...`
        );

        const compressed = await compressImageForOcr(file);
        return toBase64(compressed);
      })
    );

    setStatusText("Starting OCR...");

    const res = await fetch(`https://az-scanner-production.up.railway.app/process-pro/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: compressedBase64Files,
      }),
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Processing failed.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData: ProcessResponse | null = null;

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = JSON.parse(trimmed);

        if (event.type === "progress" && event.message) {
          setStatusText(event.message);
        }

        if (event.type === "error") {
          throw new Error(event.message || "OCR failed.");
        }

        if (event.type === "complete") {
          finalData = event.result;
        }
      }
    }

    if (!finalData) {
      throw new Error("Processing finished without a result.");
    }

    const nextLines = Array.isArray(finalData.lines) ? finalData.lines : [];
    const pageCount = finalData.files?.originalPdfImageUrls?.length || files.length;
    const nextText = nextLines.length ? linesToText(nextLines) : finalData?.text || "";

    setResult(finalData);

    const nextPageTexts = splitTextIntoPages(nextText, pageCount);
    setEditedLines([]);
    setEditedText(nextPageTexts[0] || nextText);
    setPageTexts(nextPageTexts);
    setOriginalOcrLines(nextLines);
    setOriginalOcrText(nextText);
    setTextHistory([]);
    setImageEdits(makeDefaultEdits(pageCount));
    setStatusText(
      selectedPlan === "pro"
        ? `Pro OCR complete. ${pageCount} page${pageCount === 1 ? "" : "s"} processed.`
        : `Processed ${pageCount} page${pageCount === 1 ? "" : "s"}.`
    );
    setMode("result");
    setResultTab("compare");
    setCompareView("split");
  } catch (err: any) {
    const message = err?.message || "Processing failed.";
    setError(message);
    setStatusText("Processing failed.");
    setMode("review");
  } finally {
    setLoading(false);
  }
}

  async function openCamera() {
    setCameraOpen(true);
    setCameraError("");
    setCameraLoading(true);
    setCameraReady(false);

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error("Camera is not supported in this browser.");
      }

      stopCameraStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch (err: any) {
      setCameraError(
        err?.message ||
          "Unable to access the camera. Please allow camera permission and try again."
      );
    } finally {
      setCameraLoading(false);
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCameraOpen(false);
    setCameraError("");
  }

  async function captureFromCamera() {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Camera is not ready yet.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      setCameraError("Camera frame is not ready yet.");
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Unable to capture the camera frame.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.95);
    });

    if (!blob) {
      setCameraError("Failed to create an image from the camera capture.");
      return;
    }

    const capturedFile = new File([blob], `az-scan-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    closeCamera();
    addFiles(capturedFile);
  }
  
  function updateActivePageText(text: string) {
  setPageTexts((current) => {
    const total = Math.max(originalImageUrls.length, sourcePreviews.length, files.length, 1);
    const next = current.length
      ? [...current]
      : Array.from({ length: total }, () => "");

    next[activePageIndex] = text;
    setEditedText(next.join("\n\n"));
    return next;
  });
}

function updateTextPageAt(pageIndex: number, text: string) {
  setPageTexts((current) => {
    const total = Math.max(originalImageUrls.length, sourcePreviews.length, files.length, current.length, 1);
    const next = current.length
      ? [...current]
      : Array.from({ length: total }, () => "");

    next[pageIndex] = text;
    setEditedText(next.join("\n\n"));
    return next;
  });
}

function deleteTextPageAt(pageIndex: number) {
  setPageTexts((current) => {
    const next = current.filter((_, index) => index !== pageIndex);
    setEditedText(next.join("\n\n"));
    setActivePageIndex(Math.max(0, Math.min(pageIndex, next.length - 1)));
    return next;
  });
}

function resetTextPages() {
  const total = Math.max(originalImageUrls.length, sourcePreviews.length, files.length, 1);
  const next = splitTextIntoPages(originalOcrText, total);

  setPageTexts(next);
  setEditedText(next.join("\n\n"));
  setEditedLines(originalOcrLines);
  setTextHistory([]);
}

  async function copyEditedText() {
    try {
      await navigator.clipboard.writeText(editedText || "");
      setStatusText("Text copied.");
    } catch {
      setStatusText("Copy failed. Select and copy manually.");
    }
  }

  function cleanFilenameBase(value: string) {
  return String(value || "az-scanner-document")
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "az-scanner-document";
}

function requestExportName(action: ExportAction) {
  setExportAction(action);
  setExportFilename(action.defaultName);
}

async function confirmExportName() {
  if (!exportAction) return;

  const filenameBase = cleanFilenameBase(exportFilename);
  const action = exportAction;

  setExportAction(null);
  await action.run(filenameBase);
}

function cancelExportName() {
  setExportAction(null);
}

  function downloadEditedTxt(filenameBase = "az-scanner-edited-text") {
  downloadTextFile(`${cleanFilenameBase(filenameBase)}.txt`, editedText || "");
  setStatusText("Text TXT downloaded.");
}

  async function shareEditedTxt(filenameBase = "az-scanner-edited-text") {
  const safeName = cleanFilenameBase(filenameBase);

  const shared = await shareTextFile(
    `${safeName}.txt`,
    editedText || "",
    "AZ Scanner Text"
  );

  if (shared) {
    setStatusText("Text TXT shared.");
    return;
  }

  downloadTextFile(`${safeName}.txt`, editedText || "");
  setStatusText("Sharing is not supported here. Text TXT downloaded instead.");
}

  async function downloadOriginalPdf(filenameBase = "az-scanner-original") {
    try {
      const originalUrls = result?.files?.originalPdfImageUrls || [];
      const cleanedUrls = result?.files?.cleanedImageUrls || [];
      const smartCleanColorUrls = result?.files?.smartCleanColorImageUrls || result?.files?.smartCleanImageUrls || [];
      const smartCleanBwUrls = result?.files?.smartCleanBwImageUrls || result?.files?.smartCleanImageUrls || [];

      if (!originalUrls.length) {
        throw new Error("Original PDF source is not ready.");
      }

      setStatusText("Preparing combined Original PDF...");

      const pages = originalUrls.map((originalUrl, index) => {
        const edit = imageEdits[index] || DEFAULT_IMAGE_EDIT;
        const cleanedUrl = cleanedUrls[index];
        const smartCleanUrl = edit.smartCleanMode === "bw"
          ? smartCleanBwUrls[index]
          : smartCleanColorUrls[index];
        const imageUrl = edit.pdfSource === "smartClean" && smartCleanUrl
          ? smartCleanUrl
          : edit.pdfSource === "cleaned" && cleanedUrl
            ? cleanedUrl
            : originalUrl;

        return {
          imageUrl,
          rotate: edit.rotate,
          brightness: edit.brightness,
          zoom: edit.zoom,
          panX: edit.panX,
          panY: edit.panY,
          crop: edit.crop,
        };
      });

      const res = await fetch(`${apiBase}/export/original-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          pages,
          filename: cleanFilenameBase(filenameBase),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create original PDF.");
      }

      const blob = await res.blob();
      downloadBlobFile(`${cleanFilenameBase(filenameBase)}.pdf`, blob);
      setStatusText("Original PDF downloaded.");
    } catch (err: any) {
      setStatusText(err?.message || "Original PDF download failed.");
    }
  }

  async function shareOriginalPdf(filenameBase = "az-scanner-original") {
  try {
    const originalUrls = result?.files?.originalPdfImageUrls || [];
    const cleanedUrls = result?.files?.cleanedImageUrls || [];
    const smartCleanColorUrls = result?.files?.smartCleanColorImageUrls || result?.files?.smartCleanImageUrls || [];
    const smartCleanBwUrls = result?.files?.smartCleanBwImageUrls || result?.files?.smartCleanImageUrls || [];

    if (!originalUrls.length) {
      throw new Error("Original PDF source is not ready.");
    }

    setStatusText("Preparing Original PDF to share...");

    const pages = originalUrls.map((originalUrl, index) => {
      const edit = imageEdits[index] || DEFAULT_IMAGE_EDIT;
      const cleanedUrl = cleanedUrls[index];
      const smartCleanUrl = edit.smartCleanMode === "bw"
        ? smartCleanBwUrls[index]
        : smartCleanColorUrls[index];
      const imageUrl = edit.pdfSource === "smartClean" && smartCleanUrl
        ? smartCleanUrl
        : edit.pdfSource === "cleaned" && cleanedUrl
          ? cleanedUrl
          : originalUrl;

      return {
        imageUrl,
        rotate: edit.rotate,
        brightness: edit.brightness,
        zoom: edit.zoom,
        panX: edit.panX,
        panY: edit.panY,
        crop: edit.crop,
      };
    });

    const res = await fetch(`${apiBase}/export/original-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pages,
        filename: cleanFilenameBase(filenameBase),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to create original PDF.");
    }

    const blob = await res.blob();
    const shared = await shareBlobFile(`${cleanFilenameBase(filenameBase)}.pdf`, blob, "AZ Scanner Original PDF");

    if (shared) {
      setStatusText("Original PDF shared.");
      return;
    }

    downloadBlobFile(`${cleanFilenameBase(filenameBase)}.pdf`, blob);
    setStatusText("Sharing is not supported here. Original PDF downloaded instead.");
  } catch (err: any) {
    setStatusText(err?.message || "Original PDF share failed.");
  }
}

  async function downloadEditedPdf(filenameBase = "az-scanner-edited-text") {
    try {
      setStatusText("Preparing text PDF...");

      const res = await fetch(`${apiBase}/export/text-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: editedText || "",
          filename: cleanFilenameBase(filenameBase),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create text PDF.");
      }
      const blob = await res.blob();
      downloadBlobFile(`${cleanFilenameBase(filenameBase)}.pdf`, blob);
      setStatusText("Text PDF downloaded.");
    } catch (err: any) {
      setStatusText(err?.message || "Text PDF download failed.");
    }
  }

  async function shareEditedPdf(filenameBase = "az-scanner-edited-text") {
  try {
    setStatusText("Preparing Text PDF to share...");

    const res = await fetch(`${apiBase}/export/text-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: editedText || "",
        filename: cleanFilenameBase(filenameBase),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to create text PDF.");
    }

    const blob = await res.blob();
    const shared = await shareBlobFile(`${cleanFilenameBase(filenameBase)}.pdf`, blob, "AZ Scanner Text PDF");

    if (shared) {
      setStatusText("Text PDF shared.");
      return;
    }

    downloadBlobFile(`${cleanFilenameBase(filenameBase)}.pdf`, blob);
    setStatusText("Sharing is not supported here. Text PDF downloaded instead.");
  } catch (err: any) {
    setStatusText(err?.message || "Text PDF share failed.");
  }
}

async function downloadEditedDocx(filenameBase = "az-scanner-edited-text") {
  try {
    setStatusText("Preparing Word DOCX...");

    const res = await fetch(`${apiBase}/export/text-docx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: editedText || "",
        filename: cleanFilenameBase(filenameBase),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to create Word DOCX.");
    }

    const blob = await res.blob();
    downloadBlobFile(`${cleanFilenameBase(filenameBase)}.docx`, blob);
    setStatusText("Word DOCX downloaded.");
  } catch (err: any) {
    setStatusText(err?.message || "Word DOCX download failed.");
  }
}

async function shareEditedDocx(filenameBase = "az-scanner-edited-text") {
  try {
    setStatusText("Preparing Word DOCX to share...");

    const res = await fetch(`${apiBase}/export/text-docx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: editedText || "",
        filename: cleanFilenameBase(filenameBase),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to create Word DOCX.");
    }

    const blob = await res.blob();
    const shared = await shareBlobFile(
      `${cleanFilenameBase(filenameBase)}.docx`,
      blob,
      "AZ Scanner Word DOCX"
    );

    if (shared) {
      setStatusText("Word DOCX shared.");
      return;
    }

    downloadBlobFile(`${cleanFilenameBase(filenameBase)}.docx`, blob);
    setStatusText("Sharing is not supported here. Word DOCX downloaded instead.");
  } catch (err: any) {
    setStatusText(err?.message || "Word DOCX share failed.");
  }
}


  function updateEditedLine(id: string, text: string) {
    setEditedLines((current) => {
      const next = current.map((line) => (line.id === id ? { ...line, text } : line));
      setEditedText(linesToText(next));
      return next;
    });
  }

  function removeEditedLine(id: string) {
    setEditedLines((current) => {
      const next = current.filter((line) => line.id !== id);
      setEditedText(linesToText(next));
      return next;
    });
  }

  function splitTextIntoPages(text: string, pageCount: number) {
  const clean = String(text || "").trim();

  if (!pageCount) return [];
  if (!clean) return Array.from({ length: pageCount }, () => "");

  const pageChunks = clean
    .split(/(?=Page\s+\d+)/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  if (pageChunks.length >= pageCount) {
    return Array.from({ length: pageCount }, (_, index) => pageChunks[index] || "");
  }

  return Array.from({ length: pageCount }, (_, index) =>
    index === 0 ? clean : ""
  );
}

  function requestApplyEditToAllPages() {
  setApplyAllModalOpen(true);
  }

  function confirmApplyEditToAllPages() {
    const currentEdit = imageEdits[activePageIndex] || DEFAULT_IMAGE_EDIT;

    setImageEdits((current) =>
      current.map(() => ({
        ...currentEdit,
        crop: { ...currentEdit.crop },
        applied: true,
      }))
    );

    setApplyAllModalOpen(false);
    setStatusText(`Applied current page settings to ${imageEdits.length} page${imageEdits.length === 1 ? "" : "s"}.`);
  }

  function cancelApplyEditToAllPages() {
    setApplyAllModalOpen(false);
  }

  function updateActiveImageEdit(next: ImageEditSettings) {
    setImageEdits((current) => {
      const copy = current.length ? [...current] : makeDefaultEdits(originalImageUrls.length || files.length || 1);
      copy[activePageIndex] = next;
      return copy;
    });
  }

  function applyTextTool(tool: "clean" | "spacing" | "blankLines" | "mergeLines") {
  setEditedText((current) => {
    setTextHistory((history) => [...history.slice(-9), current]);

    const next =
      tool === "clean"
        ? cleanStandardText(current)
        : tool === "spacing"
          ? normalizeSpacing(current)
          : tool === "blankLines"
            ? removeExtraBlankLines(current)
            : tool === "mergeLines"
              ? mergeLines(current)
              : current;

    setEditedLines([]);
    return next;
  });
}

function undoTextTool() {
  setTextHistory((history) => {
    const previous = history[history.length - 1];

    if (previous === undefined) return history;

    setEditedText(previous);
    setEditedLines([]);
    return history.slice(0, -1);
  });
}

function resetOcrText() {
  setEditedText(originalOcrText);
  setEditedLines(originalOcrLines);
  setTextHistory([]);
}

  useEffect(() => {
    return () => {
      stopCameraStream();
      for (const url of sourcePreviews) URL.revokeObjectURL(url);
    };
  }, [sourcePreviews]);



function estimateProjectBytes(projectData: any) {
  try {
    return new Blob([JSON.stringify(projectData || {})], {
      type: "application/json",
    }).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number) {
  const safe = Math.max(0, Number(bytes || 0));

  if (safe >= 1073741824) return `${(safe / 1073741824).toFixed(2)} GB`;
  if (safe >= 1048576) return `${(safe / 1048576).toFixed(1)} MB`;
  if (safe >= 1024) return `${(safe / 1024).toFixed(1)} KB`;

  return `${safe} B`;
}

function privateStoragePercent() {
  if (!storageUsage.privateLimitBytes) return 0;

  return Math.min(
    100,
    Math.round((storageUsage.privateUsedBytes / storageUsage.privateLimitBytes) * 100)
  );
}

async function ensureUserStorage(userId: string) {
  if (!supabase) return null;

  const { data: existing, error: readError } = await supabase
    .from("user_storage")
    .select("private_used_bytes,private_limit_bytes,share_used_bytes,share_limit_bytes")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) return existing;

  const { data, error } = await supabase
    .from("user_storage")
    .insert({ user_id: userId })
    .select("private_used_bytes,private_limit_bytes,share_used_bytes,share_limit_bytes")
    .single();

  if (error) throw error;

  return data;
}

async function loadStorageUsage(userId = currentUser?.id) {
  if (!supabase || !userId) {
    setStorageUsage({
      privateUsedBytes: 0,
      privateLimitBytes: 1073741824,
      shareUsedBytes: 0,
      shareLimitBytes: 1073741824,
    });
    return;
  }

  try {
    const data = await ensureUserStorage(userId);

    setStorageUsage({
      privateUsedBytes: Number(data?.private_used_bytes || 0),
      privateLimitBytes: Number(data?.private_limit_bytes || 1073741824),
      shareUsedBytes: Number(data?.share_used_bytes || 0),
      shareLimitBytes: Number(data?.share_limit_bytes || 1073741824),
    });
  } catch (err: any) {
    setStatusText(err?.message || "Could not load storage usage.");
  }
}

async function loadHistoryItems(userId = currentUser?.id) {
  if (!supabase || !userId) {
    setHistoryItems([]);
    return;
  }

  const { data, error } = await supabase
    .from("private_projects")
    .select("id,title,project_data,storage_bytes,created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    setStatusText(error.message || "Could not load Private Folder.");
    setHistoryItems([]);
    return;
  }

  setHistoryItems(
    (data || []).map((item: any) => {
      const projectData = item.project_data || {};
      const projectText =
        projectData.editedText ||
        (Array.isArray(projectData.pageTexts) ? projectData.pageTexts.join("\n\n") : "");

      return {
        id: item.id,
        title: item.title || "Untitled project",
        createdAt: item.created_at,
        pageCount: Number(projectData.pageCount || projectData.pageTexts?.length || 1),
        text: projectText,
        projectData,
        storageBytes: Number(item.storage_bytes || 0),
      };
    })
  );
}

function buildCurrentProjectData(now = new Date()) {
  const pageCount = Math.max(originalImageUrls.length, sourcePreviews.length, pageTexts.length, 1);
  const text = pageTexts.join("\n\n") || editedText || originalOcrText || "";

  return {
    version: 1,
    kind: "az-scanner-project",
    savedAt: now.toISOString(),
    selectedPlan,
    pageCount,
    activePageIndex,
    resultTab,
    compareView,
    pageTexts,
    editedText: text,
    originalOcrText,
    imageEdits,
    resultFiles: result?.files || null,
  };
}

async function saveCurrentScanToHistory() {
  if (!supabase) {
    setStatusText("Supabase is not configured.");
    return;
  }

  if (!currentUser) {
    setAuthMode("login");
    setAuthMessage("Log in or create an account to save to Private Folder.");
    setActiveDrawerSection("account");
    setHistoryOpen(true);
    return;
  }

  if (!result?.success) {
    setStatusText("No completed scan to save yet.");
    return;
  }

  try {
    setStatusText("Checking Private Folder storage...");

    const now = new Date();
    const title = `Scan ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const projectData = buildCurrentProjectData(now);
    const storageBytes = estimateProjectBytes(projectData);

    const usage = await ensureUserStorage(currentUser.id);
    const privateUsed = Number(usage?.private_used_bytes || 0);
    const privateLimit = Number(usage?.private_limit_bytes || 1073741824);

    if (privateUsed + storageBytes > privateLimit) {
      setStatusText(
        `Private Folder is full. ${formatBytes(privateUsed)} used of ${formatBytes(privateLimit)}.`
      );
      return;
    }

    setStatusText("Saving editable project to Private Folder...");

    const { error } = await supabase.from("private_projects").insert({
      owner_id: currentUser.id,
      title,
      project_data: projectData,
      storage_bytes: storageBytes,
    });

    if (error) throw error;

    const { error: quotaError } = await supabase
      .from("user_storage")
      .update({
        private_used_bytes: privateUsed + storageBytes,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", currentUser.id);

    if (quotaError) throw quotaError;

    await Promise.all([loadHistoryItems(currentUser.id), loadStorageUsage(currentUser.id)]);
    setStatusText("Editable project saved to Private Folder.");
  } catch (err: any) {
    setStatusText(err?.message || "Could not save to Private Folder.");
  }
}

function openHistoryItem(item: HistoryItem) {
  const project = item.projectData || null;
  const nextPageCount = Math.max(item.pageCount, 1);
  const nextPageTexts = Array.isArray(project?.pageTexts)
    ? project.pageTexts
    : splitTextIntoPages(item.text, nextPageCount);

  setPageTexts(nextPageTexts);
  setEditedText(project?.editedText || item.text || nextPageTexts.join("\n\n"));
  setOriginalOcrText(project?.originalOcrText || item.text || "");
  setEditedLines([]);
  setOriginalOcrLines([]);
  setImageEdits(
    Array.isArray(project?.imageEdits) && project.imageEdits.length
      ? project.imageEdits
      : makeDefaultEdits(nextPageCount)
  );
  setResult({
    success: true,
    text: project?.editedText || item.text || nextPageTexts.join("\n\n"),
    files: project?.resultFiles || {},
  });
  setActivePageIndex(Math.max(0, Math.min(project?.activePageIndex || 0, nextPageCount - 1)));
  setResultTab(project?.resultTab || "text");
  setCompareView(project?.compareView || "split");
  setMode("result");
  setHistoryOpen(false);
  setStatusText(`Opened ${item.title}.`);
}

async function renameHistoryItem(id: string) {
  if (!supabase || !currentUser) return;

  const current = historyItems.find((item) => item.id === id);
  if (!current) return;

  const nextTitle = window.prompt("Rename project", current.title)?.trim();
  if (!nextTitle) return;

  const { error } = await supabase
    .from("private_projects")
    .update({ title: nextTitle })
    .eq("id", id)
    .eq("owner_id", currentUser.id);

  if (error) {
    setStatusText(error.message || "Rename failed.");
    return;
  }

  await loadHistoryItems(currentUser.id);
}

async function deleteHistoryItem(id: string) {
  if (!supabase || !currentUser) return;

  const current = historyItems.find((item) => item.id === id);
  if (!current) return;

  const confirmed = window.confirm("Delete this private project?");
  if (!confirmed) return;

  const storageBytes = Number(current.storageBytes || 0);
  const nextUsed = Math.max(0, storageUsage.privateUsedBytes - storageBytes);

  const { error } = await supabase
    .from("private_projects")
    .delete()
    .eq("id", id)
    .eq("owner_id", currentUser.id);

  if (error) {
    setStatusText(error.message || "Delete failed.");
    return;
  }

  const { error: quotaError } = await supabase
    .from("user_storage")
    .update({
      private_used_bytes: nextUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", currentUser.id);

  if (quotaError) {
    setStatusText(quotaError.message || "Storage update failed.");
  }

  await Promise.all([loadHistoryItems(currentUser.id), loadStorageUsage(currentUser.id)]);
}

function downloadHistoryItem(item: HistoryItem) {
  const project = item.projectData || {
    version: 1,
    kind: "az-scanner-project",
    title: item.title,
    pageCount: item.pageCount,
    editedText: item.text,
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  downloadBlobFile(`${cleanFilenameBase(item.title)}.azscan.json`, blob);
  setStatusText("Private project backup downloaded.");
}

async function shareHistoryItem(item: HistoryItem) {
  const project = item.projectData || {
    version: 1,
    kind: "az-scanner-project",
    title: item.title,
    pageCount: item.pageCount,
    editedText: item.text,
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  const shared = await shareBlobFile(`${cleanFilenameBase(item.title)}.azscan.json`, blob, item.title);

  if (shared) {
    setStatusText("Private project backup shared.");
    return;
  }

  downloadBlobFile(`${cleanFilenameBase(item.title)}.azscan.json`, blob);
  setStatusText("Sharing is not supported here. Private project backup downloaded instead.");
}


async function ensureShareFolder(userId = currentUser?.id) {
  if (!supabase || !userId) throw new Error("Supabase is not configured.");

  const { data: existing, error: existingError } = await supabase
    .from("share_folders")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("share_folders")
    .insert({
      owner_id: userId,
      title: "Share Folder",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function loadSharedProjects(userId = currentUser?.id) {
  if (!supabase || !userId) {
    setSharedProjects([]);
    return;
  }

  const { data: projects, error } = await supabase
    .from("shared_projects")
    .select("id,title,project_data,storage_bytes,created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    setStatusText(error.message || "Could not load Share Folder.");
    setSharedProjects([]);
    return;
  }

  const projectIds = (projects || []).map((item: any) => item.id);

  let members: any[] = [];

  if (projectIds.length) {
    const { data: memberRows, error: memberError } = await supabase
      .from("shared_project_members")
      .select("id,shared_project_id,member_email,can_view,can_download,can_print,can_reshare")
      .eq("owner_id", userId)
      .in("shared_project_id", projectIds);

    if (memberError) {
      setStatusText(memberError.message || "Could not load shared users.");
    } else {
      members = memberRows || [];
    }
  }

  setSharedProjects(
    (projects || []).map((item: any) => ({
      id: item.id,
      title: item.title || "Untitled shared project",
      createdAt: item.created_at,
      storageBytes: Number(item.storage_bytes || 0),
      projectData: item.project_data || null,
      members: members
        .filter((member: any) => member.shared_project_id === item.id)
        .map((member: any) => ({
          id: member.id,
          sharedProjectId: member.shared_project_id,
          memberEmail: member.member_email,
          canView: Boolean(member.can_view),
          canDownload: Boolean(member.can_download),
          canPrint: Boolean(member.can_print),
          canReshare: Boolean(member.can_reshare),
        })),
    }))
  );
}

async function loadSharedWithMe(user = currentUser) {
  if (!supabase || !user?.email) {
    setSharedWithMeItems([]);
    return;
  }

  const email = user.email.trim().toLowerCase();

  const { data: memberRows, error: memberError } = await supabase
    .from("shared_project_members")
    .select("shared_project_id,owner_id,can_view,can_download,can_print,can_reshare")
    .ilike("member_email", email)
    .eq("can_view", true);

  if (memberError) {
    setSharedWithMeItems([]);
    return;
  }

  const memberships = memberRows || [];
  const projectIds = memberships.map((item: any) => item.shared_project_id);

  if (!projectIds.length) {
    setSharedWithMeItems([]);
    return;
  }

  const { data: projects, error: projectError } = await supabase
    .from("shared_projects")
    .select("id,title,owner_id,project_data,storage_bytes,created_at")
    .in("id", projectIds)
    .order("created_at", { ascending: false });

  if (projectError) {
    setSharedWithMeItems([]);
    return;
  }

  setSharedWithMeItems(
    (projects || []).map((project: any) => {
      const membership = memberships.find((item: any) => item.shared_project_id === project.id);

      return {
        id: project.id,
        title: project.title || "Shared project",
        createdAt: project.created_at,
        ownerId: project.owner_id,
        storageBytes: Number(project.storage_bytes || 0),
        projectData: project.project_data || null,
        canDownload: Boolean(membership?.can_download),
        canPrint: Boolean(membership?.can_print),
        canReshare: Boolean(membership?.can_reshare),
      };
    })
  );
}

async function addPrivateProjectToShareFolder(item: HistoryItem) {
  if (!supabase || !currentUser) {
    setAuthMode("login");
    setActiveDrawerSection("account");
    setDrawerView("section");
    setHistoryOpen(true);
    return;
  }

  const firstWarning = window.confirm(
    "Warning: You are adding this project to Share Folder. Only users you add by email will be able to see it. Continue?"
  );

  if (!firstWarning) return;

  const secondWarning = window.confirm(
    "Second warning: This shared copy can be downloaded or printed by users you allow. You can remove access later. Add it now?"
  );

  if (!secondWarning) return;

  try {
    setStatusText("Checking Share Folder storage...");

    const storageBytes = Number(item.storageBytes || estimateProjectBytes(item.projectData || {}));
    const usage = await ensureUserStorage(currentUser.id);
    const shareUsed = Number(usage?.share_used_bytes || 0);
    const shareLimit = Number(usage?.share_limit_bytes || 1073741824);

    if (shareUsed + storageBytes > shareLimit) {
      setStatusText(`Share Folder is full. ${formatBytes(shareUsed)} used of ${formatBytes(shareLimit)}.`);
      return;
    }

    const folderId = await ensureShareFolder(currentUser.id);

    const { error } = await supabase.from("shared_projects").insert({
      folder_id: folderId,
      owner_id: currentUser.id,
      private_project_id: item.id,
      title: item.title,
      project_data: item.projectData || {},
      storage_bytes: storageBytes,
    });

    if (error) throw error;

    const { error: quotaError } = await supabase
      .from("user_storage")
      .update({
        share_used_bytes: shareUsed + storageBytes,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", currentUser.id);

    if (quotaError) throw quotaError;

    await Promise.all([loadSharedProjects(currentUser.id), loadStorageUsage(currentUser.id)]);
    setActiveDrawerSection("share");
    setDrawerView("section");
    setStatusText("Project added to Share Folder.");
  } catch (err: any) {
    setStatusText(err?.message || "Could not add project to Share Folder.");
  }
}

async function deleteSharedProject(projectId: string) {
  if (!supabase || !currentUser) return;

  const project = sharedProjects.find((item) => item.id === projectId);
  if (!project) return;

  const confirmed = window.confirm("Delete this project from Share Folder and remove all access?");
  if (!confirmed) return;

  const nextShareUsed = Math.max(0, storageUsage.shareUsedBytes - Number(project.storageBytes || 0));

  const { error } = await supabase
    .from("shared_projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", currentUser.id);

  if (error) {
    setStatusText(error.message || "Could not delete shared project.");
    return;
  }

  const { error: quotaError } = await supabase
    .from("user_storage")
    .update({
      share_used_bytes: nextShareUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", currentUser.id);

  if (quotaError) {
    setStatusText(quotaError.message || "Storage update failed.");
  }

  await Promise.all([loadSharedProjects(currentUser.id), loadStorageUsage(currentUser.id)]);
}

async function addSharedMember(projectId: string) {
  if (!supabase || !currentUser) return;

  const email = (shareEmailDrafts[projectId] || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    setStatusText("Enter a valid user email.");
    return;
  }

  const project = sharedProjects.find((item) => item.id === projectId);

  if (project?.members.some((member) => member.memberEmail.toLowerCase() === email)) {
    setStatusText("That user already has access to this file.");
    return;
  }

  const { error } = await supabase.from("shared_project_members").insert({
    shared_project_id: projectId,
    owner_id: currentUser.id,
    member_email: email,
    can_view: true,
    can_download: true,
    can_print: true,
    can_reshare: false,
  });

  if (error) {
    setStatusText(error.message || "Could not add user.");
    return;
  }

  setShareEmailDrafts((current) => ({ ...current, [projectId]: "" }));
  await loadSharedProjects(currentUser.id);
}

async function toggleSharedMember(member: ShareMember, field: "canView" | "canDownload" | "canPrint" | "canReshare") {
  if (!supabase || !currentUser) return;

  const column =
    field === "canView"
      ? "can_view"
      : field === "canDownload"
        ? "can_download"
        : field === "canPrint"
          ? "can_print"
          : "can_reshare";

  const nextValue = !member[field];

  const { error } = await supabase
    .from("shared_project_members")
    .update({ [column]: nextValue })
    .eq("id", member.id)
    .eq("owner_id", currentUser.id);

  if (error) {
    setStatusText(error.message || "Could not update access.");
    return;
  }

  await loadSharedProjects(currentUser.id);
}

async function removeSharedMember(memberId: string) {
  if (!supabase || !currentUser) return;

  const { error } = await supabase
    .from("shared_project_members")
    .delete()
    .eq("id", memberId)
    .eq("owner_id", currentUser.id);

  if (error) {
    setStatusText(error.message || "Could not remove user.");
    return;
  }

  await loadSharedProjects(currentUser.id);
}

async function renameSharedProject(id: string) {
  if (!supabase || !currentUser) return;

  const current = sharedProjects.find((item) => item.id === id);
  if (!current) return;

  const nextTitle = window.prompt("Rename shared project", current.title)?.trim();
  if (!nextTitle) return;

  const { error } = await supabase
    .from("shared_projects")
    .update({ title: nextTitle, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", currentUser.id);

  if (error) {
    setStatusText(error.message || "Rename failed.");
    return;
  }

  await loadSharedProjects(currentUser.id);
}

function previewPrivateProject(item: HistoryItem) {
  setPreviewProject({
    title: item.title,
    subtitle: `${item.pageCount} page${item.pageCount === 1 ? "" : "s"} • ${formatBytes(item.storageBytes || 0)} • ${new Date(item.createdAt).toLocaleDateString()}`,
    projectData: item.projectData || {},
    storageBytes: item.storageBytes || 0,
    source: "private",
    canDownload: true,
  });
}

function previewSharedProject(item: SharedProjectItem) {
  setPreviewProject({
    title: item.title,
    subtitle: `${formatBytes(item.storageBytes || 0)} • ${new Date(item.createdAt).toLocaleDateString()}`,
    projectData: item.projectData || {},
    storageBytes: item.storageBytes || 0,
    source: "share",
    canDownload: true,
  });
}

function previewSharedWithMeProject(item: SharedWithMeItem) {
  setPreviewProject({
    title: item.title,
    subtitle: `Shared by user • ${formatBytes(item.storageBytes || 0)} • ${new Date(item.createdAt).toLocaleDateString()}`,
    projectData: item.projectData || {},
    storageBytes: item.storageBytes || 0,
    source: "sharedWithMe",
    canDownload: item.canDownload,
  });
}

function openPreviewProject() {
  if (!previewProject) return;
  openSharedProject(previewProject.projectData, previewProject.title);
}

function downloadPreviewProject() {
  if (!previewProject || !previewProject.canDownload) return;
  const blob = new Blob([JSON.stringify(previewProject.projectData || {}, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlobFile(`${cleanFilenameBase(previewProject.title)}.azscan.json`, blob);
  setStatusText("Project backup downloaded.");
}

function openSharedProject(projectData: any, title: string) {
  const nextPageCount = Math.max(
    Number(projectData?.pageCount || projectData?.pageTexts?.length || 1),
    1
  );
  const nextPageTexts = Array.isArray(projectData?.pageTexts)
    ? projectData.pageTexts
    : splitTextIntoPages(projectData?.editedText || "", nextPageCount);

  setPageTexts(nextPageTexts);
  setEditedText(projectData?.editedText || nextPageTexts.join("\n\n"));
  setOriginalOcrText(projectData?.originalOcrText || projectData?.editedText || "");
  setEditedLines([]);
  setOriginalOcrLines([]);
  setImageEdits(
    Array.isArray(projectData?.imageEdits) && projectData.imageEdits.length
      ? projectData.imageEdits
      : makeDefaultEdits(nextPageCount)
  );
  setResult({
    success: true,
    text: projectData?.editedText || nextPageTexts.join("\n\n"),
    files: projectData?.resultFiles || {},
  });
  setActivePageIndex(Math.max(0, Math.min(projectData?.activePageIndex || 0, nextPageCount - 1)));
  setResultTab(projectData?.resultTab || "text");
  setCompareView(projectData?.compareView || "split");
  setMode("result");
  setHistoryOpen(false);
  setStatusText(`Opened ${title}.`);
}

function downloadSharedProject(item: SharedWithMeItem | SharedProjectItem) {
  const blob = new Blob([JSON.stringify(item.projectData || {}, null, 2)], {
    type: "application/json;charset=utf-8",
  });

  downloadBlobFile(`${cleanFilenameBase(item.title)}.azscan.json`, blob);
  setStatusText("Shared project backup downloaded.");
}

function drawerSectionTitle(section: DrawerSection) {
  if (section === "account") return "Account";
  if (section === "private") return "Private Folder";
  if (section === "share") return "Share Folder";
  if (section === "sharedWithMe") return "Shared With Me";
  if (section === "settings") return "Settings";
  return "Help & Reports";
}


async function submitAuthForm(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!supabase) {
    setAuthMessage("Supabase is not configured.");
    return;
  }

  setAuthLoading(true);
  setAuthMessage("");

  try {
    if (authMode === "register") {
      const firstName = authFirstName.trim();
      const lastName = authLastName.trim();
      const phone = authPhone.trim();

      if (!firstName || !lastName) {
        setAuthMessage("First name and last name are required.");
        setAuthLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone: phone || null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
        });

        if (profileError) throw profileError;
      }

      setAuthFirstName("");
      setAuthLastName("");
      setAuthPhone("");
      setAuthMessage("Account created. Check your email if confirmation is required.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) throw error;

      setAuthEmail("");
      setAuthPassword("");
      setAuthFirstName("");
      setAuthLastName("");
      setAuthPhone("");
      setAuthMessage("");
    }
  } catch (err: any) {
    setAuthMessage(err?.message || "Authentication failed.");
  } finally {
    setAuthLoading(false);
  }
}

async function signOutUser() {
  if (!supabase) return;

  await supabase.auth.signOut();
  setCurrentUser(null);
  setHistoryItems([]);
  setSharedProjects([]);
  setSharedWithMeItems([]);
  setStatusText("Logged out.");
}

useEffect(() => {
  if (!supabase) return;

  let mounted = true;

  supabase.auth.getUser().then(({ data }) => {
    if (!mounted) return;

    setCurrentUser(data.user || null);

    if (data.user) {
      loadHistoryItems(data.user.id);
      loadStorageUsage(data.user.id);
      loadSharedProjects(data.user.id);
      loadSharedWithMe(data.user);
    }
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user || null;
    setCurrentUser(user);

    if (user) {
      setAuthEmail("");
      setAuthPassword("");
      setAuthFirstName("");
      setAuthLastName("");
      setAuthPhone("");
      setAuthMessage("");
      loadHistoryItems(user.id);
      loadStorageUsage(user.id);
      loadSharedProjects(user.id);
      loadSharedWithMe(user);
    } else {
      setHistoryItems([]);
      setSharedProjects([]);
      setSharedWithMeItems([]);
      setStorageUsage({
        privateUsedBytes: 0,
        privateLimitBytes: 1073741824,
        shareUsedBytes: 0,
        shareLimitBytes: 1073741824,
      });
    }
  });

  return () => {
    mounted = false;
    listener.subscription.unsubscribe();
  };
}, [supabase]);


  return (
    <main className={`az-app ${selectedPlan === "pro" ? "az-app-pro" : ""}`}>
      <div className="az-shell">
       <header className="az-topbar az-app-topbar">
          <img
            src="/az-logo.png"
            alt="AZ Scanner"
            className="az-topbar-logo az-topbar-logo-left"
          />

          <div className="az-topbar-copy">
            <div className="az-topbar-title">{topTitle}</div>

            <div
              className={
                loading
                  ? "az-topbar-subtitle az-topbar-subtitle-processing"
                  : "az-topbar-subtitle"
              }
            >
              {mode === "result"
                ? `Page ${activePageIndex + 1} of ${Math.max(originalImageUrls.length, sourcePreviews.length, 1)} • ${
                    activeImageEdit.applied ? "Saved" : "Unsaved changes"
                  }`
                : statusText}
            </div>
          </div>

          <button
            type="button"
            className="az-user-menu-button"
            onClick={() => {
              setHistoryOpen(true);
            }}
            aria-label="Open account menu"
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9" />
              <path
                d="M4.8 20C5.6 16.4 8.35 14.4 12 14.4C15.65 14.4 18.4 16.4 19.2 20"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>

            {sharedWithMeUserCount > 0 ? (
              <span className="az-user-menu-badge">{sharedWithMeUserCount}</span>
            ) : null}
          </button>
        </header>
        <section className="az-content">
          {mode === "start" ? (
            <StartScreen
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              onOpenCamera={openCamera}
              onChooseFiles={addFiles}
            />
          ) : null}

          {mode === "review" ? (
           <ReviewScreen
              selectedPlan={selectedPlan}
              sourcePreviews={sourcePreviews}
              activePageIndex={activePageIndex}
              error={error}
              onSelectPage={setActivePageIndex}
              onRemovePage={removePage}
              onMovePage={movePage}
            />
          ) : null}

          {mode === "result" ? (
            <ResultScreen
              smartCleanImageHref={smartCleanImageHref}
              smartCleanColorImageHref={smartCleanColorImageHref}
              smartCleanBwImageHref={smartCleanBwImageHref}
              loading={loading}
              result={result}
              selectedPlan={selectedPlan}
              resultTab={resultTab}
              compareView={compareView}
              canUndoText={textHistory.length > 0}
              onUndoText={undoTextTool}
              onResetOcrText={resetOcrText}
              sourcePreview={sourcePreviews[activePageIndex] || ""}
              originalImageHref={originalImageHref}
              cleanedImageHref={cleanedImageHref}
              editedText={pageTexts[activePageIndex] || ""}
              pageTexts={pageTexts}
              editedLines={[]}
              imageEdit={activeImageEdit}
              activePageIndex={activePageIndex}
              pageCount={Math.max(originalImageUrls.length, sourcePreviews.length, 1)}
              onSetEditedText={updateActivePageText}
              onUpdateTextPage={updateTextPageAt}
              onDeleteTextPage={deleteTextPageAt}
              onResetTextPages={resetTextPages}
              onUpdateEditedLine={updateEditedLine}
              onRemoveEditedLine={removeEditedLine}
              onCopyText={copyEditedText}
              onApplyTextTool={applyTextTool}
              onImageEditChange={updateActiveImageEdit}
              onApplyEditToAllPages={requestApplyEditToAllPages}
              onSelectPage={setActivePageIndex}
              onMovePage={movePage}
              onResultTabChange={setResultTab}
              onCompareViewChange={setCompareView}
              onDownloadOriginalPdf={() =>
                requestExportName({
                  title: "Name Original PDF",
                  defaultName: "az-scanner-original",
                  run: downloadOriginalPdf,
                })
              }
              onDownloadEditedTxt={() =>
                requestExportName({
                  title: "Name Text TXT",
                  defaultName: "az-scanner-edited-text",
                  run: downloadEditedTxt,
                })
              }
              onDownloadEditedPdf={() =>
                requestExportName({
                  title: "Name Text PDF",
                  defaultName: "az-scanner-edited-text",
                  run: downloadEditedPdf,
                })
              }
              onShareOriginalPdf={() =>
                requestExportName({
                  title: "Name Original PDF to share",
                  defaultName: "az-scanner-original",
                  run: shareOriginalPdf,
                })
              }
              onShareEditedTxt={() =>
                requestExportName({
                  title: "Name Text TXT to share",
                  defaultName: "az-scanner-edited-text",
                  run: shareEditedTxt,
                })
              }
              onShareEditedPdf={() =>
                requestExportName({
                  title: "Name Text PDF to share",
                  defaultName: "az-scanner-edited-text",
                  run: shareEditedPdf,
                })
              }
              onDownloadEditedDocx={() =>
                requestExportName({
                  title: "Name Word DOCX",
                  defaultName: "az-scanner-edited-text",
                  run: downloadEditedDocx,
                })
              }
              onShareEditedDocx={() =>
                requestExportName({
                  title: "Name Word DOCX to share",
                  defaultName: "az-scanner-edited-text",
                  run: shareEditedDocx,
                })
              }
            />
          ) : null}
      </section>

        <BottomBar
          mode={mode}
          loading={loading}
          fileCount={files.length}
          canOpenReview={files.length > 0}
          canOpenResult={!!result?.success}
          onOpenCamera={openCamera}
          onChooseFiles={addFiles}
          onProcess={processSelectedFiles}
          onNewScan={clearAll}
          onGoToStart={() => setMode("start")}
          onGoToReview={() => files.length && setMode("review")}
          onGoToResult={() => result?.success && setMode("result")}
          onOpenHistory={() => {
            setActiveDrawerSection("private");
            setDrawerView("section");
            setHistoryOpen(true);
          }}
         
        />
      </div>

          {exportAction ? (
            <div className="az-modal-backdrop" role="dialog" aria-modal="true">
              <div className="az-download-modal">
                <div className="az-download-modal-kicker">FILE NAME</div>
                <h2 className="az-download-modal-title">{exportAction.title}</h2>
                <p className="az-download-modal-copy">
                  Choose a clean file name. The correct file extension will be added automatically.
                </p>

                <input
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="az-filename-input"
                  autoFocus
                />

                <div className="az-download-modal-actions">
                  <button type="button" onClick={cancelExportName} className="az-secondary-button">
                    Cancel
                  </button>

                  <button type="button" onClick={confirmExportName} className="az-primary-button">
                    Continue
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        
        {applyAllModalOpen ? (
          <div className="az-modal-backdrop" role="dialog" aria-modal="true">
            <div className="az-download-modal">
              <div className="az-download-modal-kicker">APPLY TO ALL</div>
              <h2 className="az-download-modal-title">Apply current page settings to all pages?</h2>
              <p className="az-download-modal-copy">
                This will copy the current rotate, crop, brightness, and color settings to every uploaded page.
                You can still edit individual pages afterward.
              </p>

              <div className="az-download-modal-actions">
                <button type="button" onClick={cancelApplyEditToAllPages} className="az-secondary-button">
                  Cancel
                </button>

                <button type="button" onClick={confirmApplyEditToAllPages} className="az-primary-button">
                  Apply to all
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {historyOpen ? (
          <div className="az-history-backdrop" onClick={() => setHistoryOpen(false)}>
            <aside
              className="az-history-drawer az-menu-drawer"
              onClick={(event) => event.stopPropagation()}
              aria-label="Account and folders drawer"
            >
              {drawerView === "menu" ? (
                <>
                  <div className="az-history-head">
                    <div>
                      <div className="az-history-kicker">AZ SCANNER</div>
                      <h2 className="az-history-title">Menu</h2>
                      <p className="az-history-user">
                        {currentUser?.email || "Login to use cloud folders."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHistoryOpen(false)}
                      className="az-history-close"
                      aria-label="Close menu"
                    >
                      ×
                    </button>
                  </div>

                  <div className="az-drawer-menu-list az-drawer-menu-list-full" aria-label="Menu sections">
                    {[
                      ["account", "Account"],
                      ["private", "Private Folder"],
                      ["share", "Share Folder"],
                      ["sharedWithMe", "Shared With Me"],
                      ["settings", "Settings"],
                      ["help", "Help & Reports"],
                    ].map(([section, label]) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => {
                          setActiveDrawerSection(section as DrawerSection);
                          setDrawerView("section");
                        }}
                        className={activeDrawerSection === section ? "az-drawer-menu-active" : ""}
                      >
                        <span>{label}</span>
                        {section === "sharedWithMe" && sharedWithMeUserCount > 0 ? (
                          <strong>{sharedWithMeUserCount}</strong>
                        ) : (
                          <span aria-hidden="true">›</span>
                        )}
                      </button>
                    ))}

                    {currentUser ? (
                      <button type="button" onClick={signOutUser} className="az-drawer-menu-danger">
                        <span>Log out</span>
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="az-section-drawer-head">
                    <button
                      type="button"
                      onClick={() => setDrawerView("menu")}
                      className="az-section-back-button"
                      aria-label="Back to menu"
                    >
                      ← {drawerSectionTitle(activeDrawerSection)}
                    </button>

                    <button
                      type="button"
                      onClick={() => setHistoryOpen(false)}
                      className="az-history-close"
                      aria-label="Close menu"
                    >
                      ×
                    </button>
                  </div>

                  <div className="az-drawer-section az-drawer-section-full">
                    {activeDrawerSection === "account" ? (
                      currentUser ? (
                        <div className="az-drawer-card">
                          <div className="az-drawer-card-label">ACCOUNT</div>
                          <h3>{currentUser.email}</h3>
                          <p>
                            Profile, name, password, secondary emails, and sub-accounts will live here.
                          </p>

                          <button
                            type="button"
                            onClick={signOutUser}
                            className="az-history-secondary-button"
                          >
                            Log out
                          </button>
                        </div>
                      ) : (
                        <form className="az-auth-card" onSubmit={submitAuthForm}>
                          <div className="az-auth-tabs">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode("login");
                                setAuthMessage("");
                              }}
                              className={authMode === "login" ? "az-auth-tab-active" : ""}
                            >
                              Login
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode("register");
                                setAuthMessage("");
                              }}
                              className={authMode === "register" ? "az-auth-tab-active" : ""}
                            >
                              Register
                            </button>
                          </div>

                          {authMode === "register" ? (
                            <>
                              <div className="az-auth-name-grid">
                                <input
                                  type="text"
                                  value={authFirstName}
                                  onChange={(event) => setAuthFirstName(event.target.value)}
                                  placeholder="First name"
                                  className="az-auth-input"
                                  autoComplete="given-name"
                                  required
                                />

                                <input
                                  type="text"
                                  value={authLastName}
                                  onChange={(event) => setAuthLastName(event.target.value)}
                                  placeholder="Last name"
                                  className="az-auth-input"
                                  autoComplete="family-name"
                                  required
                                />
                              </div>

                              <input
                                type="tel"
                                value={authPhone}
                                onChange={(event) => setAuthPhone(event.target.value)}
                                placeholder="Phone number (optional)"
                                className="az-auth-input"
                                autoComplete="tel"
                              />

                              <p className="az-auth-helper">
                                Optional: add a phone number for future 2-step security and account recovery.
                              </p>
                            </>
                          ) : null}

                          <input
                            type="email"
                            value={authEmail}
                            onChange={(event) => setAuthEmail(event.target.value)}
                            placeholder="Email"
                            className="az-auth-input"
                            autoComplete="email"
                            required
                          />

                          <input
                            type="password"
                            value={authPassword}
                            onChange={(event) => setAuthPassword(event.target.value)}
                            placeholder="Password"
                            className="az-auth-input"
                            autoComplete={authMode === "login" ? "current-password" : "new-password"}
                            required
                            minLength={6}
                          />

                          {authMessage ? (
                            <div className="az-auth-message">{authMessage}</div>
                          ) : null}

                          <button
                            type="submit"
                            disabled={authLoading}
                            className="az-history-save-button"
                          >
                            {authLoading
                              ? "Please wait..."
                              : authMode === "login"
                                ? "Login"
                                : "Create account"}
                          </button>
                        </form>
                      )
                    ) : null}

                    {activeDrawerSection === "private" ? (
                      <>
                        <div className="az-drawer-card az-private-summary-card">
                          <div className="az-drawer-card-label">PRIVATE FOLDER</div>

                          <div className="az-storage-card az-storage-card-minimal" aria-label="Private Folder storage usage">
                            <div className="az-storage-row">
                              <span>Private storage</span>
                              <strong>
                                {formatBytes(storageUsage.privateUsedBytes)} / {formatBytes(storageUsage.privateLimitBytes)}
                              </strong>
                            </div>

                            <div className="az-storage-track">
                              <span style={{ width: `${privateStoragePercent()}%` }} />
                            </div>

                            <small>{privateStoragePercent()}% used</small>
                          </div>
                        </div>

                        {previewProject && previewProject.source === "private" ? (
                          <div className="az-project-preview-box">
                            <div>
                              <strong>{previewProject.title}</strong>
                              <small>{previewProject.subtitle}</small>
                            </div>
                            <div className="az-project-preview-actions">
                              <button type="button" onClick={openPreviewProject}>Open</button>
                              {previewProject.canDownload ? (
                                <button type="button" onClick={downloadPreviewProject}>Download</button>
                              ) : null}
                              <button type="button" onClick={() => setPreviewProject(null)}>Close</button>
                            </div>
                          </div>
                        ) : null}

                        <div className="az-history-list az-private-file-list">
                          {currentUser ? (
                            historyItems.length ? (
                              historyItems.map((item) => (
                                <div key={item.id} className="az-history-item az-private-file-item">
                                  <div className="az-history-main az-private-file-main">
                                    <button
                                      type="button"
                                      onClick={() => previewPrivateProject(item)}
                                      className="az-history-folder-icon az-private-open-icon"
                                      aria-label={`Preview ${item.title}`}
                                      title="Preview"
                                    >
                                      📁
                                    </button>

                                    <span className="az-private-file-copy">
                                      <span className="az-list-title-row">
                                        <button
                                          type="button"
                                          onClick={() => previewPrivateProject(item)}
                                          className="az-private-file-title"
                                          aria-label={`Preview ${item.title}`}
                                          title="Preview"
                                        >
                                          {item.title}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => renameHistoryItem(item.id)}
                                          className="az-inline-edit-icon"
                                          aria-label={`Rename ${item.title}`}
                                          title="Rename"
                                        >
                                          ✎
                                        </button>
                                      </span>

                                      <small>
                                        {item.pageCount} page{item.pageCount === 1 ? "" : "s"} •{" "}
                                        {formatBytes(item.storageBytes || 0)} •{" "}
                                        {new Date(item.createdAt).toLocaleDateString()}
                                      </small>
                                    </span>
                                  </div>

                                  <div className="az-history-actions az-private-icon-actions">
                                    <button
                                      type="button"
                                      onClick={() => downloadHistoryItem(item)}
                                      aria-label="Download"
                                      title="Download"
                                    >
                                      ⤓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addPrivateProjectToShareFolder(item)}
                                      aria-label="Add to Share Folder"
                                      title="Add to Share Folder"
                                    >
                                      ↗
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteHistoryItem(item.id)}
                                      aria-label="Delete"
                                      title="Delete"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="az-history-empty">
                                No private projects yet. New completed scans save automatically here.
                              </div>
                            )
                          ) : (
                            <div className="az-history-empty">
                              Login or create an account to use Private Folder.
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}

                    {activeDrawerSection === "share" ? (
                      <>
                        <div className="az-drawer-card az-private-summary-card">
                          <div className="az-drawer-card-label">SHARE FOLDER</div>

                          <div className="az-storage-card az-storage-card-minimal" aria-label="Share Folder storage usage">
                            <div className="az-storage-row">
                              <span>Share storage</span>
                              <strong>
                                {formatBytes(storageUsage.shareUsedBytes)} / {formatBytes(storageUsage.shareLimitBytes)}
                              </strong>
                            </div>

                            <div className="az-storage-track">
                              <span
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round((storageUsage.shareUsedBytes / Math.max(storageUsage.shareLimitBytes, 1)) * 100)
                                  )}%`,
                                }}
                              />
                            </div>

                            <small>
                              {Math.min(
                                100,
                                Math.round((storageUsage.shareUsedBytes / Math.max(storageUsage.shareLimitBytes, 1)) * 100)
                              )}
                              % used
                            </small>
                          </div>
                        </div>

                        {previewProject && previewProject.source === "share" ? (
                          <div className="az-project-preview-box">
                            <div>
                              <strong>{previewProject.title}</strong>
                              <small>{previewProject.subtitle}</small>
                            </div>
                            <div className="az-project-preview-actions">
                              <button type="button" onClick={openPreviewProject}>Open</button>
                              {previewProject.canDownload ? (
                                <button type="button" onClick={downloadPreviewProject}>Download</button>
                              ) : null}
                              <button type="button" onClick={() => setPreviewProject(null)}>Close</button>
                            </div>
                          </div>
                        ) : null}

                        <div className="az-history-list az-compact-folder-list">
                          {currentUser ? (
                            sharedProjects.length ? (
                              sharedProjects.map((project) => (
                                <div key={project.id} className="az-history-item az-share-item">
                                  <div className="az-history-main az-share-main-static">
                                    <button type="button" onClick={() => previewSharedProject(project)} className="az-history-folder-icon az-private-open-icon" aria-label={`Preview ${project.title}`} title="Preview">🤝</button>
                                    <span>
                                      <span className="az-list-title-row">
                                        <button type="button" onClick={() => previewSharedProject(project)} className="az-private-file-title" aria-label={`Preview ${project.title}`} title="Preview">{project.title}</button>
                                        <button type="button" onClick={() => renameSharedProject(project.id)} className="az-inline-edit-icon" aria-label={`Rename ${project.title}`} title="Rename">✎</button>
                                      </span>
                                      <small>
                                        {formatBytes(project.storageBytes)} •{" "}
                                        {new Date(project.createdAt).toLocaleDateString()}
                                      </small>
                                    </span>
                                  </div>

                                  <div className="az-share-add-row">
                                    <input
                                      type="email"
                                      value={shareEmailDrafts[project.id] || ""}
                                      onChange={(event) =>
                                        setShareEmailDrafts((current) => ({
                                          ...current,
                                          [project.id]: event.target.value,
                                        }))
                                      }
                                      placeholder="Add user email"
                                      className="az-auth-input"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => addSharedMember(project.id)}
                                      className="az-history-save-button"
                                    >
                                      Add
                                    </button>
                                  </div>

                                  <div className="az-share-member-list">
                                    {project.members.length ? (
                                      project.members.map((member) => (
                                        <div key={member.id} className="az-share-member-card">
                                          <div className="az-share-member-head">
                                            <strong>{member.memberEmail}</strong>
                                            <button type="button" onClick={() => removeSharedMember(member.id)}>
                                              Remove
                                            </button>
                                          </div>

                                          <div className="az-share-permission-grid">
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={member.canView}
                                                onChange={() => toggleSharedMember(member, "canView")}
                                              />
                                              Visible
                                            </label>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={member.canDownload}
                                                onChange={() => toggleSharedMember(member, "canDownload")}
                                              />
                                              Download
                                            </label>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={member.canPrint}
                                                onChange={() => toggleSharedMember(member, "canPrint")}
                                              />
                                              Print
                                            </label>
                                            <label>
                                              <input
                                                type="checkbox"
                                                checked={member.canReshare}
                                                onChange={() => toggleSharedMember(member, "canReshare")}
                                              />
                                              Re-share
                                            </label>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="az-drawer-note">
                                        No users added yet. Add an email above to grant access.
                                      </div>
                                    )}
                                  </div>

                                  <div className="az-history-actions az-private-icon-actions">
                                    <button type="button" onClick={() => openSharedProject(project.projectData, project.title)} aria-label="Open" title="Open">↗</button>
                                    <button type="button" onClick={() => downloadSharedProject(project)} aria-label="Download" title="Download">⤓</button>
                                    <button type="button" onClick={() => deleteSharedProject(project.id)} aria-label="Delete" title="Delete">×</button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="az-history-empty">
                                No shared projects yet. Open Private Folder and tap “Add to Share” on a project.
                              </div>
                            )
                          ) : (
                            <div className="az-history-empty">
                              Login or create an account to use Share Folder.
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}

                    {activeDrawerSection === "sharedWithMe" ? (
                      <>
                        {previewProject && previewProject.source === "sharedWithMe" ? (
                          <div className="az-project-preview-box">
                            <div>
                              <strong>{previewProject.title}</strong>
                              <small>{previewProject.subtitle}</small>
                            </div>
                            <div className="az-project-preview-actions">
                              <button type="button" onClick={openPreviewProject}>Open</button>
                              {previewProject.canDownload ? (
                                <button type="button" onClick={downloadPreviewProject}>Download</button>
                              ) : null}
                              <button type="button" onClick={() => setPreviewProject(null)}>Close</button>
                            </div>
                          </div>
                        ) : null}
                        <div className="az-history-list az-compact-folder-list">
                        {currentUser ? (
                          sharedWithMeItems.length ? (
                            sharedWithMeItems.map((item) => (
                              <div key={item.id} className="az-history-item">
                                <div className="az-history-main">
                                  <button type="button" onClick={() => previewSharedWithMeProject(item)} className="az-history-folder-icon az-private-open-icon" aria-label={`Preview ${item.title}`} title="Preview">👥</button>
                                  <span>
                                    <span className="az-list-title-row">
                                      <button type="button" onClick={() => previewSharedWithMeProject(item)} className="az-private-file-title" aria-label={`Preview ${item.title}`} title="Preview">{item.title}</button>
                                    </span>
                                    <small>
                                      Shared by user • {formatBytes(item.storageBytes)} •{" "}
                                      {new Date(item.createdAt).toLocaleDateString()}
                                    </small>
                                  </span>
                                </div>

                                <div className="az-share-permission-note">
                                  {item.canDownload ? "Download allowed" : "Download disabled"} •{" "}
                                  {item.canPrint ? "Print allowed" : "Print disabled"} •{" "}
                                  {item.canReshare ? "Re-share allowed" : "Re-share disabled"}
                                </div>

                                <div className="az-history-actions az-private-icon-actions">
                                  <button type="button" onClick={() => openSharedProject(item.projectData, item.title)} aria-label="Open" title="Open">↗</button>
                                  {item.canDownload ? (
                                    <button type="button" onClick={() => downloadSharedProject(item)} aria-label="Download" title="Download">⤓</button>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="az-history-empty">
                              No shared files yet.
                            </div>
                          )
                        ) : (
                          <div className="az-history-empty">
                            Login or create an account to view files shared with you.
                          </div>
                        )}
                      </div>
                      </>
                    ) : null}

                    {activeDrawerSection === "settings" ? (
                      <div className="az-drawer-card">
                        <div className="az-drawer-card-label">SETTINGS</div>
                        <h3>Settings</h3>
                        <p>
                          App preferences, storage limits, default export choices, and scanner behavior will live here.
                        </p>
                      </div>
                    ) : null}

                    {activeDrawerSection === "help" ? (
                      <div className="az-drawer-card">
                        <div className="az-drawer-card-label">HELP & REPORTS</div>
                        <h3>Help & Reports</h3>
                        <p>
                          Contact admin, get account help, payment/billing support, and report bugs, crashes,
                          app issues, scams, or system misbehavior.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </aside>
          </div>
        ) : null}

      {cameraOpen ? (
        <CameraOverlay
        
          cameraLoading={cameraLoading}
          cameraError={cameraError}
          cameraReady={cameraReady}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onClose={closeCamera}
          onCapture={captureFromCamera}
        />
      ) : null}
    </main>
  );
}