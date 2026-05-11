"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  rotate: 0,
  brightness: 1,
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

export default function HomePage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
    []
  );

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
  
  const originalImageUrls =
    result?.files?.originalPdfImageUrls?.map((url) => `${apiBase}${url}`) ||
    (result?.files?.originalPdfImageUrl ? [`${apiBase}${result.files.originalPdfImageUrl}`] : []);

  const cleanedImageUrls =
    result?.files?.cleanedImageUrls?.map((url) => `${apiBase}${url}`) ||
    (result?.files?.cleanedImageUrl ? [`${apiBase}${result.files.cleanedImageUrl}`] : []);

  const originalImageHref =
    originalImageUrls[activePageIndex] || sourcePreviews[activePageIndex] || "";

  const cleanedImageHref = cleanedImageUrls[activePageIndex] || "";

  const activeImageEdit = imageEdits[activePageIndex] || DEFAULT_IMAGE_EDIT;

  const topTitle =
    mode === "start" ? "Start" : mode === "review" ? "Review" : "Result";

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

    setSourcePreviews((current) => moveItem(current));
    setImageEdits((current) => moveItem(current));

    setActivePageIndex((current) => {
      if (current === fromIndex) return toIndex;
      if (fromIndex < current && toIndex >= current) return current - 1;
      if (fromIndex > current && toIndex <= current) return current + 1;
      return current;
    });

    setStatusText(`Moved page ${fromIndex + 1} to position ${toIndex + 1}.`);

    return moveItem(currentFiles);
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

      const maxSide = 1800;
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
        0.82
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
      const formData = new FormData();
      for (const item of files) {
        formData.append("files", item);
      }

      const res = await fetch(`https://az-scanner-production.up.railway.app/process-pro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

       body: JSON.stringify({
        files: await Promise.all(
          files.map(async (file, index) => {
            setStatusText(
              selectedPlan === "pro"
                ? `Preparing page ${index + 1} of ${files.length} for Pro OCR...`
                : `Preparing image ${index + 1} of ${files.length}...`
            );

            const compressed = await compressImageForOcr(file);
            return toBase64(compressed);
          })
        ),
      }),
    });

      setStatusText("Running OCR and building your scan...");

      const contentType = res.headers.get("content-type") || "";
      let data: ProcessResponse = {};

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Server returned a non-JSON response.");
      }

      if (!res.ok) throw new Error(data?.error || "Processing failed.");

      const nextLines = Array.isArray(data.lines) ? data.lines : [];
      const pageCount = data.files?.originalPdfImageUrls?.length || files.length;
      const nextText = nextLines.length ? linesToText(nextLines) : data?.text || "";

      setResult(data);
      setEditedLines(nextLines);
      setEditedText(nextText);
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
    } 
      catch (err: any) {
      const message = err?.message || "Load failed";
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

      if (!originalUrls.length) {
        throw new Error("Original PDF source is not ready.");
      }

      setStatusText("Preparing combined Original PDF...");

      const pages = originalUrls.map((originalUrl, index) => {
        const edit = imageEdits[index] || DEFAULT_IMAGE_EDIT;
        const cleanedUrl = cleanedUrls[index];
        const imageUrl = edit.pdfSource === "cleaned" && cleanedUrl ? cleanedUrl : originalUrl;

        return {
          imageUrl,
          rotate: edit.rotate,
          brightness: edit.brightness,
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

    if (!originalUrls.length) {
      throw new Error("Original PDF source is not ready.");
    }

    setStatusText("Preparing Original PDF to share...");

    const pages = originalUrls.map((originalUrl, index) => {
      const edit = imageEdits[index] || DEFAULT_IMAGE_EDIT;
      const cleanedUrl = cleanedUrls[index];
      const imageUrl = edit.pdfSource === "cleaned" && cleanedUrl ? cleanedUrl : originalUrl;

      return {
        imageUrl,
        rotate: edit.rotate,
        brightness: edit.brightness,
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

  return (
    <main className={`az-app ${selectedPlan === "pro" ? "az-app-pro" : ""}`}>
      <div className="az-shell">
        <header className="az-topbar">
          <div>
            <img
                src="/az-logo.png"
                alt="AZ Scanner"
                className="az-topbar-logo"
              />
            <div className="az-topbar-title">{topTitle}</div>
            <div className="az-topbar-subtitle">{statusText}</div>
          </div>
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
              editedText={editedText}
              editedLines={editedLines}
              imageEdit={activeImageEdit}
              activePageIndex={activePageIndex}
              pageCount={Math.max(originalImageUrls.length, sourcePreviews.length, 1)}
              onSetEditedText={setEditedText}
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