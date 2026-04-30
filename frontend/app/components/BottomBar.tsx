"use client";

import type { ScreenMode } from "../types";

type BottomBarProps = {
  mode: ScreenMode;
  loading: boolean;
  file: File | null;
  pdfHref: string;
  canOpenReview: boolean;
  canOpenResult: boolean;
  onOpenCamera: () => void;
  onChooseFile: (file: File | null) => void;
  onProcess: () => void;
  onNewScan: () => void;
  onGoToStart: () => void;
  onGoToReview: () => void;
  onGoToResult: () => void;
  onDownloadEditedTxt: () => void;
  onDownloadEditedPdf: () => void;
};

export default function BottomBar({
  mode,
  loading,
  file,
  pdfHref,
  canOpenReview,
  canOpenResult,
  onOpenCamera,
  onChooseFile,
  onProcess,
  onNewScan,
  onGoToStart,
  onGoToReview,
  onGoToResult,
  onDownloadEditedTxt,
  onDownloadEditedPdf,
}: BottomBarProps) {
  return (
    <footer className="az-bottom-area">
      <div className="az-bottom-actions">
        {mode === "start" ? (
          <>
            <button type="button" onClick={onOpenCamera} className="az-primary-button">
              Open camera
            </button>

            <label className="az-secondary-button az-file-label">
              Choose file
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                className="hidden"
                onChange={(e) => onChooseFile(e.target.files?.[0] || null)}
              />
            </label>
          </>
        ) : null}

        {mode === "review" ? (
          <>
            <button type="button" onClick={onOpenCamera} className="az-secondary-button">
              Retake
            </button>

            <label className="az-secondary-button az-file-label">
              Replace
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                className="hidden"
                onChange={(e) => onChooseFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              type="button"
              onClick={onProcess}
              disabled={loading || !file}
              className="az-primary-button disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing..." : "Process"}
            </button>
          </>
        ) : null}

        {mode === "result" ? (
          <>
            <a
              href={pdfHref || undefined}
              target="_blank"
              rel="noreferrer"
              className={[
                "az-secondary-button az-link-button",
                pdfHref ? "" : "pointer-events-none opacity-45",
              ].join(" ")}
            >
              Original PDF
            </a>

            <button type="button" onClick={onDownloadEditedTxt} className="az-secondary-button">
              Text TXT
            </button>

            <button type="button" onClick={onDownloadEditedPdf} className="az-secondary-button">
              Text PDF
            </button>

            <button type="button" onClick={onNewScan} className="az-primary-button">
              New scan
            </button>
          </>
        ) : null}
      </div>

      <nav className="az-bottom-nav" aria-label="Workflow navigation">
        <button
          type="button"
          onClick={onGoToStart}
          className={["az-nav-item", mode === "start" ? "az-nav-item-active" : ""].join(" ")}
        >
          Start
        </button>

        <button
          type="button"
          onClick={onGoToReview}
          disabled={!canOpenReview}
          className={["az-nav-item", mode === "review" ? "az-nav-item-active" : ""].join(" ")}
        >
          Review
        </button>

        <button
          type="button"
          onClick={onGoToResult}
          disabled={!canOpenResult}
          className={["az-nav-item", mode === "result" ? "az-nav-item-active" : ""].join(" ")}
        >
          Result
        </button>
      </nav>
    </footer>
  );
}