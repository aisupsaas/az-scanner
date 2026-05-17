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
  onOpenHistory: () => void;
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
  onOpenHistory,
}: BottomBarProps) {
  return (
    <footer className="az-bottom-area">
      <div className={mode === "review" ? "az-bottom-actions az-bottom-actions-row" : "az-bottom-actions"}>
        {mode === "review" ? (
          <>
            <button type="button" onClick={onOpenCamera} className="az-line-action-button">
              <span>Camera</span>
            </button>

            <label className="az-line-action-button az-file-label">
              <span>Add files</span>
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
              className={[
                "az-line-action-button",
                loading ? "az-line-action-button-processing" : "",
                !loading && fileCount < 1
                  ? "disabled:cursor-not-allowed disabled:opacity-50"
                  : "",
              ].join(" ")}
            >
              <span>{loading ? "Processing..." : "Process"}</span>
            </button>
          </>
        ) : null}

        {mode === "result" ? (
          <button type="button" onClick={onNewScan} className="az-line-action-button az-line-action-single">
            <span>New scan</span>
          </button>
        ) : null}
      </div>

      <nav className="az-line-nav az-line-nav-with-history" aria-label="Workflow navigation">
        <button
          type="button"
          onClick={onGoToStart}
          className={["az-line-nav-item", mode === "start" ? "az-line-nav-item-active" : ""].join(" ")}
        >
          <span>Start</span>
        </button>

        <button
          type="button"
          onClick={onGoToReview}
          disabled={!canOpenReview}
          className={["az-line-nav-item", mode === "review" ? "az-line-nav-item-active" : ""].join(" ")}
        >
          <span>Review</span>
        </button>

        <button
          type="button"
          onClick={onGoToResult}
          disabled={!canOpenResult}
          className={["az-line-nav-item", mode === "result" ? "az-line-nav-item-active" : ""].join(" ")}
        >
          <span>Result</span>
        </button>

        <button
          type="button"
          onClick={onOpenHistory}
          className="az-line-nav-item az-history-nav-item"
        >
          <span>Private</span>
        </button>
      </nav>
    </footer>
  );
}
