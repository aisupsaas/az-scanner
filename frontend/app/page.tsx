"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompareView, ProcessResponse, ResultTab, ScreenMode } from "./types";
import { cleanStandardText, mergeLines, normalizeSpacing, removeExtraBlankLines } from "./utils/textTools";
import { downloadBlobFile, downloadTextFile } from "./utils/downloads";
import StartScreen from "./components/StartScreen";
import ReviewScreen from "./components/ReviewScreen";
import ResultScreen from "./components/ResultScreen";
import CameraOverlay from "./components/CameraOverlay";
import BottomBar from "./components/BottomBar";

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
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("Ready to scan or upload.");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanedImageHref = result?.files?.cleanedImageUrl
    ? `${apiBase}${result.files.cleanedImageUrl}`
    : "";

  const pdfHref = result?.files?.pdfUrl ? `${apiBase}${result.files.pdfUrl}` : "";
  const txtHref = result?.files?.txtUrl ? `${apiBase}${result.files.txtUrl}` : "";

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

      setResult(data);
      setEditedText(data?.text || "");
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

  function applyTextTool(tool: "clean" | "spacing" | "blankLines" | "mergeLines") {
    setEditedText((current) => {
      if (tool === "clean") return cleanStandardText(current);
      if (tool === "spacing") return normalizeSpacing(current);
      if (tool === "blankLines") return removeExtraBlankLines(current);
      if (tool === "mergeLines") return mergeLines(current);
      return current;
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
            <ReviewScreen
              sourcePreview={sourcePreview}
              error={error}
            />
          ) : null}

          {mode === "result" ? (
            <ResultScreen
              loading={loading}
              result={result}
              resultTab={resultTab}
              compareView={compareView}
              sourcePreview={sourcePreview}
              cleanedImageHref={cleanedImageHref}
              editedText={editedText}
              onSetEditedText={setEditedText}
              onCopyText={copyEditedText}
              onApplyTextTool={applyTextTool}
              onResultTabChange={setResultTab}
              onCompareViewChange={setCompareView}
            />
          ) : null}
        </section>

        <BottomBar
          mode={mode}
          loading={loading}
          file={file}
          pdfHref={pdfHref}
          onDownloadEditedPdf={downloadEditedPdf}
          canOpenReview={!!file}
          canOpenResult={!!result?.success}
          onOpenCamera={openCamera}
          onChooseFile={chooseLocalFile}
          onProcess={handleSubmit}
          onNewScan={clearAll}
          onGoToStart={() => setMode("start")}
          onGoToReview={() => file && setMode("review")}
          onGoToResult={() => result?.success && setMode("result")}
          onDownloadEditedTxt={downloadEditedTxt}
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