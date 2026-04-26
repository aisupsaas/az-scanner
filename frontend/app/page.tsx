"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ScreenMode = "start" | "review" | "result";
type ResultTab = "text" | "compare";
type CompareView = "split" | "original" | "cleaned";

type ProcessResponse = {
  success?: boolean;
  text?: string;
  files?: {
    cleanedImageUrl?: string;
    pdfUrl?: string;
    txtUrl?: string;
  };
  error?: string;
};

export default function HomePage() {
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000",
    []
  );

  const [mode, setMode] = useState<ScreenMode>("start");
  const [resultTab, setResultTab] = useState<ResultTab>("text");
  const [compareView, setCompareView] = useState<CompareView>("split");

  const [file, setFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResponse | null>(null);
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

  function revokeSourcePreview() {
    setSourcePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }

  function stopCameraStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
    setCameraLoading(false);
  }

  function clearAll() {
    setFile(null);
    setResult(null);
    setError("");
    setLoading(false);
    setStatusText("Ready to scan or upload.");
    setMode("start");
    setResultTab("text");
    setCompareView("split");
    revokeSourcePreview();
  }

  async function processSelectedFile(nextFile: File) {
    setLoading(true);
    setError("");
    setResult(null);
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

      if (!res.ok) {
        throw new Error(data?.error || "Processing failed.");
      }

      setResult(data);
      setStatusText(`Processed: ${nextFile.name}`);
      setMode("result");
      setResultTab("compare");
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

  function chooseLocalFile(next: File | null) {
    setFile(next);
    setResult(null);
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
        video: {
          facingMode: { ideal: "environment" },
        },
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

  function navDisabled(target: ScreenMode) {
    if (target === "start") return false;
    if (target === "review") return !file;
    if (target === "result") return !result?.success;
    return false;
  }

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (sourcePreview) URL.revokeObjectURL(sourcePreview);
    };
  }, [sourcePreview]);

  const topTitle =
    mode === "start" ? "Start" : mode === "review" ? "Review" : "Result";

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
            <div className="az-screen az-screen-center">
              <div className="az-hero-card">
                <div className="az-kicker">MOBILE SCAN FLOW</div>
                <h1 className="az-hero-title">
                  Scan documents and export clean text.
                </h1>
                <p className="az-hero-copy">
                  Capture with the camera or upload an image, then review and export
                  the result.
                </p>

                <div className="az-start-actions">
                  <button
                    type="button"
                    onClick={openCamera}
                    className="az-primary-button"
                  >
                    Open camera
                  </button>

                  <label className="az-secondary-button az-file-label">
                    Choose file
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                      className="hidden"
                      onChange={(e) => chooseLocalFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {mode === "review" ? (
            <div className="az-screen">
              <div className="az-panel-card az-panel-card-fill">
                <div className="az-panel-header">
                  <div>
                    <div className="az-section-label">IMAGE REVIEW</div>
                    <div className="az-section-copy">
                      Confirm the captured or uploaded document before processing.
                    </div>
                  </div>
                </div>

                <div className="az-preview-stage">
                  {sourcePreview ? (
                    <img
                      src={sourcePreview}
                      alt="Selected document preview"
                      className="az-main-preview"
                    />
                  ) : (
                    <div className="az-empty-note">No image selected yet.</div>
                  )}
                </div>

                {error ? (
                  <div className="az-inline-error">
                    <div className="az-inline-error-title">Load failed</div>
                    <div className="az-inline-error-copy">{error}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {mode === "result" ? (
            <div className="az-screen">
              <div className="az-result-tabs">
                <button
                  type="button"
                  onClick={() => setResultTab("compare")}
                  className={[
                    "az-tab-button",
                    resultTab === "compare" ? "az-tab-button-active" : "",
                  ].join(" ")}
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={() => setResultTab("text")}
                  className={[
                    "az-tab-button",
                    resultTab === "text" ? "az-tab-button-active" : "",
                  ].join(" ")}
                >
                  Text
                </button>
              </div>

              <div className="az-panel-card az-panel-card-fill">
                {resultTab === "text" ? (
                  <>
                    <div className="az-panel-header">
                      <div>
                        <div className="az-section-label">EXTRACTED TEXT</div>
                        <div className="az-section-copy">
                          Scroll inside this panel if the text is long.
                        </div>
                      </div>
                    </div>

                    <div className="az-scroll-panel">
                      <pre className="az-text-output">
                        {loading
                          ? "Processing document..."
                          : result?.text || "Your extracted text will appear here."}
                      </pre>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="az-panel-header az-panel-header-wrap">
                      <div>
                        <div className="az-section-label">ORIGINAL / CLEANED</div>
                        <div className="az-section-copy">
                          Review the source and cleaned result side by side or separately.
                        </div>
                      </div>

                      <div className="az-compare-toggle">
                        <button
                          type="button"
                          onClick={() => setCompareView("split")}
                          className={[
                            "az-segment-button",
                            compareView === "split" ? "az-segment-button-active" : "",
                          ].join(" ")}
                        >
                          Split
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompareView("original")}
                          className={[
                            "az-segment-button",
                            compareView === "original" ? "az-segment-button-active" : "",
                          ].join(" ")}
                        >
                          Original
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompareView("cleaned")}
                          className={[
                            "az-segment-button",
                            compareView === "cleaned" ? "az-segment-button-active" : "",
                          ].join(" ")}
                        >
                          Cleaned
                        </button>
                      </div>
                    </div>

                    <div
                      className={[
                        "az-compare-stage",
                        compareView === "split" ? "az-compare-stage-split" : "",
                      ].join(" ")}
                    >
                      {(compareView === "split" || compareView === "original") && (
                        <div className="az-compare-panel">
                          <div className="az-compare-label">Original</div>
                          <div className="az-compare-frame">
                            {sourcePreview ? (
                              <img
                                src={sourcePreview}
                                alt="Original document preview"
                                className="az-main-preview"
                              />
                            ) : (
                              <div className="az-empty-note">Original preview is not available.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {(compareView === "split" || compareView === "cleaned") && (
                        <div className="az-compare-panel">
                          <div className="az-compare-label">Cleaned</div>
                          <div className="az-compare-frame">
                            {cleanedImageHref ? (
                              <img
                                src={cleanedImageHref}
                                alt="Cleaned document preview"
                                className="az-main-preview"
                              />
                            ) : (
                              <div className="az-empty-note">Cleaned preview is not available.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <footer className="az-bottom-area">
          <div className="az-bottom-actions">
            {mode === "start" ? (
              <>
                <button
                  type="button"
                  onClick={openCamera}
                  className="az-primary-button"
                >
                  Open camera
                </button>

                <label className="az-secondary-button az-file-label">
                  Choose file
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                    className="hidden"
                    onChange={(e) => chooseLocalFile(e.target.files?.[0] || null)}
                  />
                </label>
              </>
            ) : null}

            {mode === "review" ? (
              <>
                <button
                  type="button"
                  onClick={openCamera}
                  className="az-secondary-button"
                >
                  Retake
                </button>

                <label className="az-secondary-button az-file-label">
                  Replace
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                    className="hidden"
                    onChange={(e) => chooseLocalFile(e.target.files?.[0] || null)}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !file}
                  className="az-primary-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Process"}
                </button>
              </>
            ) : null}

            {mode === "result" ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode("review")}
                  className="az-secondary-button"
                >
                  Retake
                </button>

                <a
                  href={pdfHref || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    "az-secondary-button az-link-button",
                    pdfHref ? "" : "pointer-events-none opacity-45",
                  ].join(" ")}
                >
                  PDF
                </a>

                <a
                  href={txtHref || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    "az-secondary-button az-link-button",
                    txtHref ? "" : "pointer-events-none opacity-45",
                  ].join(" ")}
                >
                  TXT
                </a>

                <button
                  type="button"
                  onClick={clearAll}
                  className="az-primary-button"
                >
                  New scan
                </button>
              </>
            ) : null}
          </div>

          <nav className="az-bottom-nav" aria-label="Workflow navigation">
            <button
              type="button"
              onClick={() => setMode("start")}
              className={[
                "az-nav-item",
                mode === "start" ? "az-nav-item-active" : "",
              ].join(" ")}
            >
              Start
            </button>

            <button
              type="button"
              onClick={() => !navDisabled("review") && setMode("review")}
              disabled={navDisabled("review")}
              className={[
                "az-nav-item",
                mode === "review" ? "az-nav-item-active" : "",
              ].join(" ")}
            >
              Review
            </button>

            <button
              type="button"
              onClick={() => !navDisabled("result") && setMode("result")}
              disabled={navDisabled("result")}
              className={[
                "az-nav-item",
                mode === "result" ? "az-nav-item-active" : "",
              ].join(" ")}
            >
              Result
            </button>
          </nav>
        </footer>
      </div>

      {cameraOpen ? (
        <div className="az-camera-fullscreen" role="dialog" aria-modal="true" aria-label="Camera capture">
          <div className="az-camera-topbar">
            <button
              type="button"
              onClick={closeCamera}
              className="az-camera-top-button"
            >
              Close
            </button>

            <div className="az-camera-title-wrap">
              <div className="az-camera-title">Scanner Camera</div>
              <div className="az-camera-subtitle">Align the document inside the frame</div>
            </div>

            <div className="az-camera-top-spacer" />
          </div>

          <div className="az-camera-viewport">
            {cameraLoading ? (
              <div className="az-camera-message">Opening camera...</div>
            ) : cameraError ? (
              <div className="az-camera-message az-camera-message-error">
                {cameraError}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="az-camera-video-full"
                  playsInline
                  muted
                  autoPlay
                />
                <div className="az-camera-frame" />
              </>
            )}
          </div>

          <div className="az-camera-bottombar">
            <button
              type="button"
              onClick={closeCamera}
              className="az-camera-secondary"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={captureFromCamera}
              disabled={!cameraReady || cameraLoading}
              className="az-camera-shutter disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Capture"
            >
              <span className="az-camera-shutter-inner" />
            </button>

            <div className="az-camera-hint">Capture</div>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      ) : null}
    </main>
  );
}