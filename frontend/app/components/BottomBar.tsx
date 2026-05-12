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
          <button type="button" onClick={onNewScan} className="az-line-action-button">
            New scan
          </button>
        ) : null}
      </div>

      <nav className="az-bottom-nav az-line-nav" aria-label="Workflow navigation">
        <button
          type="button"
          onClick={onGoToStart}
          className={["az-line-nav-item", mode === "start" ? "az-line-nav-item-active" : ""].join(" ")}
        >
          Start
        </button>

        <button
          type="button"
          onClick={onGoToReview}
          disabled={!canOpenReview}
          className={["az-line-nav-item", mode === "review" ? "az-line-nav-item-active" : ""].join(" ")}
        >
          Review
        </button>

        <button
          type="button"
          onClick={onGoToResult}
          disabled={!canOpenResult}
          className={["az-line-nav-item", mode === "result" ? "az-line-nav-item-active" : ""].join(" ")}
        >
          Result
        </button>
      </nav>
    </footer>
  );
}