"use client";

import type { CompareView, ProcessResponse, ResultTab } from "../types";

type TextTool = "clean" | "spacing" | "blankLines" | "mergeLines";

type ResultScreenProps = {
  result: ProcessResponse | null;
  loading: boolean;
  resultTab: ResultTab;
  compareView: CompareView;
  sourcePreview: string;
  cleanedImageHref: string;
  editedText: string;
  onSetEditedText: (text: string) => void;
  onCopyText: () => void | Promise<void>;
  onApplyTextTool: (tool: TextTool) => void;
  onResultTabChange: (tab: ResultTab) => void;
  onCompareViewChange: (view: CompareView) => void;
};

export default function ResultScreen({
  result,
  loading,
  resultTab,
  compareView,
  sourcePreview,
  cleanedImageHref,
  editedText,
  onSetEditedText,
  onCopyText,
  onApplyTextTool,
  onResultTabChange,
  onCompareViewChange,
}: ResultScreenProps) {
  return (
    <div className="az-screen">
      <div className="az-result-tabs">
        <button
          type="button"
          onClick={() => onResultTabChange("compare")}
          className={[
            "az-tab-button",
            resultTab === "compare" ? "az-tab-button-active" : "",
          ].join(" ")}
        >
          Compare
        </button>

        <button
          type="button"
          onClick={() => onResultTabChange("text")}
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
            <div className="az-panel-header az-panel-header-wrap">
              <div>
                <div className="az-section-label">EDITABLE TEXT</div>
                <div className="az-section-copy">
                  Review, fix, remove garbage text, then copy or export.
                </div>
              </div>

              <div className="az-compare-toggle">
                <button
                  type="button"
                  onClick={() => onApplyTextTool("clean")}
                  className="az-segment-button"
                >
                  Clean
                </button>

                <button
                  type="button"
                  onClick={() => onApplyTextTool("spacing")}
                  className="az-segment-button"
                >
                  Spacing
                </button>

                <button
                  type="button"
                  onClick={() => onApplyTextTool("blankLines")}
                  className="az-segment-button"
                >
                  Lines
                </button>

                <button
                  type="button"
                  onClick={() => onApplyTextTool("mergeLines")}
                  className="az-segment-button"
                >
                  Merge
                </button>
              </div>
            </div>

            {result?.warning ? (
              <div className="az-inline-error">
                <div className="az-inline-error-title">OCR warning</div>
                <div className="az-inline-error-copy">{result.warning}</div>
              </div>
            ) : null}

            <div className="az-scroll-panel">
              <textarea
                value={
                  loading
                    ? "Processing document..."
                    : editedText || "Your extracted text will appear here."
                }
                disabled={loading}
                onChange={(e) => onSetEditedText(e.target.value)}
                className="az-text-editor"
                spellCheck={false}
              />
            </div>

            <div className="az-text-actions">
              <button
                type="button"
                onClick={onCopyText}
                className="az-secondary-button"
              >
                Copy text
              </button>
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
                  onClick={() => onCompareViewChange("split")}
                  className={[
                    "az-segment-button",
                    compareView === "split" ? "az-segment-button-active" : "",
                  ].join(" ")}
                >
                  Split
                </button>

                <button
                  type="button"
                  onClick={() => onCompareViewChange("original")}
                  className={[
                    "az-segment-button",
                    compareView === "original" ? "az-segment-button-active" : "",
                  ].join(" ")}
                >
                  Original
                </button>

                <button
                  type="button"
                  onClick={() => onCompareViewChange("cleaned")}
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
                      <div className="az-empty-note">
                        Original preview is not available.
                      </div>
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
                      <div className="az-empty-note">
                        Cleaned preview is not available.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}