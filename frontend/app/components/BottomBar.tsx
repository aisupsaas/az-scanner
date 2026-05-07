"use client";

import type { ScreenMode } from "../types";

type BottomBarProps = {
  mode: ScreenMode;
  loading: boolean;
  fileCount: number;
  canOpenReview: boolean;
  canOpenResult: boolean;
  onOpenCamera: () => void;
  onChooseFiles: (files: FileList | File[]) => void;
  onProcess: () => void;
  onNewScan: () => void;
  onGoToStart: () => void;
  onGoToReview: () => void;
  onGoToResult: () => void;
  onDownloadOriginalPdf: () => void;
  onDownloadEditedTxt: () => void;
  onDownloadEditedPdf: () => void;

  onShareOriginalPdf: () => void;
  onShareEditedTxt: () => void;
  onShareEditedPdf: () => void;
  };

export default function BottomBar({
  mode,
  loading,
  fileCount,
  canOpenReview,
  canOpenResult,
  onOpenCamera,
  onChooseFiles,
  onProcess,
  onNewScan,
  onGoToStart,
  onGoToReview,
  onGoToResult,
  onDownloadOriginalPdf,
  onDownloadEditedTxt,
  onDownloadEditedPdf,

  onShareOriginalPdf,
  onShareEditedTxt,
  onShareEditedPdf,
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
              Choose files
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) onChooseFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </>
        ) : null}

        {mode === "review" ? (
          <>
            <button type="button" onClick={onOpenCamera} className="az-secondary-button">
              Add photo
            </button>

            <label className="az-secondary-button az-file-label">
              Add files
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) onChooseFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              type="button"
              onClick={onProcess}
              disabled={loading || fileCount < 1}
              className="az-primary-button disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing..." : "Process"}
            </button>
          </>
        ) : null}

                       {mode === "result" ? (
          <>
            <button type="button" onClick={onDownloadOriginalPdf} className="az-secondary-button">
              Download Original PDF
            </button>

            <button type="button" onClick={onShareOriginalPdf} className="az-secondary-button">
              Share Original PDF
            </button>

            <button type="button" onClick={onDownloadEditedTxt} className="az-secondary-button">
              Download Text TXT
            </button>

            <button type="button" onClick={onShareEditedTxt} className="az-secondary-button">
              Share Text TXT
            </button>

            <button type="button" onClick={onDownloadEditedPdf} className="az-secondary-button">
              Download Text PDF
            </button>

            <button type="button" onClick={onShareEditedPdf} className="az-secondary-button">
              Share Text PDF
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