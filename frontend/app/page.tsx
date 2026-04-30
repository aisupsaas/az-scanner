"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CompareView,
  ImageEditSettings,
  OcrLine,
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
import { downloadBlobFile, downloadTextFile } from "./utils/downloads";
import StartScreen from "./components/StartScreen";
import ReviewScreen from "./components/ReviewScreen";
import ResultScreen from "./components/ResultScreen";
import CameraOverlay from "./components/CameraOverlay";
import BottomBar from "./components/BottomBar";

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
};

function linesToText(lines: OcrLine[]) {
  return lines
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join("\n");
}

export default function HomePage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
    []
  );

  const [mode, setMode] = useState<ScreenMode>("start");
  const [resultTab, setResultTab] = useState<ResultTab>("text");
  const [compareView, setCompareView] = useState<CompareView>("split");

  const [file, setFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedLines, setEditedLines] = useState<OcrLine[]>([]);
  const [imageEdit, setImageEdit] = useState<ImageEditSettings>(DEFAULT_IMAGE_EDIT);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("Ready to scan or upload.");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const originalImageHref = result?.files?.originalPdfImageUrl
    ? `${apiBase}${result.files.originalPdfImageUrl}`
    : sourcePreview;

  const cleanedImageHref = result?.files?.cleanedImageUrl
    ? `${apiBase}${result.files.cleanedImageUrl}`
    : "";

  const topTitle =
    mode === "start" ? "Start" : mode === "review" ? "Review" : "Result";

  function revokeSourcePreview() {
    setSourcePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
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
    setFile(null);
    setResult(null);
    setEditedText("");
    setEditedLines([]);
    setImageEdit(DEFAULT_IMAGE_EDIT);
    setError("");
    setLoading(false);
    setStatusText("Ready to scan or upload.");
    setMode("start");
    setResultTab("text");
    setCompareView("split");
    revokeSourcePreview();
  }

  function chooseLocalFile(next: File | null) {
    setFile(next);
    setResult(null);
    setEditedText("");
    setEditedLines([]);
    setImageEdit(DEFAULT_IMAGE_EDIT);
    setError("");
    setResultTab("text");
    setCompareView("split");
    revokeSourcePreview();

    if (!next) {
      setStatusText("Ready to scan or upload.");
      setMode("start");
      return;
    }

    const preview = URL.createObjectURL(next);
    setSourcePreview(preview);
    setStatusText(`Selected: ${next.name}`);
    setMode("review");
  }

  async function processSelectedFile(nextFile: File) {
    setLoading(true);
    setError("");
    setResult(null);
    setEditedText("");
    setEditedLines([]);
    setStatusText(`Processing: ${nextFile.name}`);
    setMode("review");

    try {
      const formData = new FormData();
      formData.append("file", nextFile);

      const res = await fetch(`${apiBase}/process`, {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";
      let data: ProcessResponse = {};

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Server returned a non-JSON response.");
      }

      if (!res.ok) throw new Error(data?.error || "Processing failed.");

      const nextLines = Array.isArray(data.lines) ? data.lines : [];

      setResult(data);
      setEditedLines(nextLines);
      setEditedText(nextLines.length ? linesToText(nextLines) : data?.text || "");
      setStatusText(`Processed: ${nextFile.name}`);
      setMode("result");
      setResultTab("text");
      setCompareView(data?.files?.cleanedImageUrl ? "split" : "original");
    } catch (err: any) {
      const message = err?.message || "Load failed";
      setError(message);
      setStatusText(`Failed: ${nextFile.name}`);
      setMode("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!file) {
      setError("Please choose an image first.");
      return;
    }

    await processSelectedFile(file);
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
    chooseLocalFile(capturedFile);
  }

  async function copyEditedText() {
    try {
      await navigator.clipboard.writeText(editedText || "");
      setStatusText("Text copied.");
    } catch {
      setStatusText("Copy failed. Select and copy manually.");
    }
  }

  function downloadEditedTxt() {
    downloadTextFile("az-scanner-edited-text.txt", editedText || "");
  }

  async function downloadOriginalPdf() {
    try {
      const selectedImageUrl =
        imageEdit.pdfSource === "cleaned"
          ? result?.files?.cleanedImageUrl
          : result?.files?.originalPdfImageUrl;

      if (!selectedImageUrl) {
        throw new Error("Original PDF source is not ready.");
      }

      setStatusText("Preparing original PDF...");

      const res = await fetch(`${apiBase}/export/original-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: selectedImageUrl,
          filename: "az-scanner-original",
          rotate: imageEdit.rotate,
          brightness: imageEdit.brightness,
          crop: imageEdit.crop,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create original PDF.");
      }

      const blob = await res.blob();
      downloadBlobFile("az-scanner-original.pdf", blob);
      setStatusText("Original PDF downloaded.");
    } catch (err: any) {
      setStatusText(err?.message || "Original PDF download failed.");
    }
  }

  async function downloadEditedPdf() {
    try {
      setStatusText("Preparing text PDF...");

      const res = await fetch(`${apiBase}/export/text-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: editedText || "",
          filename: "az-scanner-edited-text",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create text PDF.");
      }

      const blob = await res.blob();
      downloadBlobFile("az-scanner-edited-text.pdf", blob);
      setStatusText("Text PDF downloaded.");
    } catch (err: any) {
      setStatusText(err?.message || "Text PDF download failed.");
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

  function applyTextTool(tool: "clean" | "spacing" | "blankLines" | "mergeLines") {
    setEditedText((current) => {
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

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    };
  }, [sourcePreview]);

  return (
    <main className="az-app">
      <div className="az-shell">
        <header className="az-topbar">
          <div>
            <div className="az-topbar-chip">AZ SCANNER</div>
            <div className="az-topbar-title">{topTitle}</div>
            <div className="az-topbar-subtitle">{statusText}</div>
          </div>
        </header>

        <section className="az-content">
          {mode === "start" ? (
            <StartScreen onOpenCamera={openCamera} onChooseFile={chooseLocalFile} />
          ) : null}

          {mode === "review" ? (
            <ReviewScreen sourcePreview={sourcePreview} error={error} />
          ) : null}

          {mode === "result" ? (
            <ResultScreen
              loading={loading}
              result={result}
              resultTab={resultTab}
              compareView={compareView}
              sourcePreview={sourcePreview}
              originalImageHref={originalImageHref}
              cleanedImageHref={cleanedImageHref}
              editedText={editedText}
              editedLines={editedLines}
              imageEdit={imageEdit}
              onSetEditedText={setEditedText}
              onUpdateEditedLine={updateEditedLine}
              onRemoveEditedLine={removeEditedLine}
              onCopyText={copyEditedText}
              onApplyTextTool={applyTextTool}
              onImageEditChange={setImageEdit}
              onResultTabChange={setResultTab}
              onCompareViewChange={setCompareView}
            />
          ) : null}
        </section>

        <BottomBar
          mode={mode}
          loading={loading}
          file={file}
          canOpenReview={!!file}
          canOpenResult={!!result?.success}
          onOpenCamera={openCamera}
          onChooseFile={chooseLocalFile}
          onProcess={handleSubmit}
          onNewScan={clearAll}
          onGoToStart={() => setMode("start")}
          onGoToReview={() => file && setMode("review")}
          onGoToResult={() => result?.success && setMode("result")}
          onDownloadOriginalPdf={downloadOriginalPdf}
          onDownloadEditedTxt={downloadEditedTxt}
          onDownloadEditedPdf={downloadEditedPdf}
        />
      </div>

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