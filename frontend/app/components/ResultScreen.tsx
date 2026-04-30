"use client";

import type {
  CompareView,
  ImageEditSettings,
  OcrLine,
  ProcessResponse,
  ResultTab,
} from "../types";

type TextTool = "clean" | "spacing" | "blankLines" | "mergeLines";

type ResultScreenProps = {
  result: ProcessResponse | null;
  loading: boolean;
  resultTab: ResultTab;
  compareView: CompareView;
  sourcePreview: string;
  originalImageHref: string;
  cleanedImageHref: string;
  editedText: string;
  editedLines: OcrLine[];
  imageEdit: ImageEditSettings;
  onSetEditedText: (text: string) => void;
  onUpdateEditedLine: (id: string, text: string) => void;
  onRemoveEditedLine: (id: string) => void;
  onCopyText: () => void | Promise<void>;
  onApplyTextTool: (tool: TextTool) => void;
  onImageEditChange: (settings: ImageEditSettings) => void;
  onResultTabChange: (tab: ResultTab) => void;
  onCompareViewChange: (view: CompareView) => void;
};

export default function ResultScreen({
  result,
  loading,
  resultTab,
  compareView,
  sourcePreview,
  originalImageHref,
  cleanedImageHref,
  editedText,
  editedLines,
  imageEdit,
  onSetEditedText,
  onUpdateEditedLine,
  onRemoveEditedLine,
  onCopyText,
  onApplyTextTool,
  onImageEditChange,
  onResultTabChange,
  onCompareViewChange,
}: ResultScreenProps) {
  const previewImage =
    imageEdit.pdfSource === "cleaned" && cleanedImageHref
      ? cleanedImageHref
      : originalImageHref || sourcePreview;

  const rotationStyle = {
    transform: `rotate(${imageEdit.rotate}deg)`,
    filter: `brightness(${imageEdit.brightness})`,
  };

  function setCropSide(side: keyof ImageEditSettings["crop"], value: number) {
    onImageEditChange({
      ...imageEdit,
      crop: {
        ...imageEdit.crop,
        [side]: value,
      },
    });
  }

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
          Scan
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
                  Edit detected lines, remove bad OCR guesses, then export TXT or Text PDF.
                </div>
              </div>

              <div className="az-compare-toggle">
                <button type="button" onClick={() => onApplyTextTool("clean")} className="az-segment-button">
                  Clean
                </button>
                <button type="button" onClick={() => onApplyTextTool("spacing")} className="az-segment-button">
                  Spacing
                </button>
                <button type="button" onClick={() => onApplyTextTool("blankLines")} className="az-segment-button">
                  Lines
                </button>
                <button type="button" onClick={() => onApplyTextTool("mergeLines")} className="az-segment-button">
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
              {editedLines.length ? (
                <div className="az-line-editor-list">
                  {editedLines.map((line, index) => (
                    <div className="az-line-editor-row" key={line.id}>
                      <div className="az-line-editor-index">{index + 1}</div>

                      <input
                        value={line.text}
                        onChange={(e) => onUpdateEditedLine(line.id, e.target.value)}
                        className="az-line-editor-input"
                        spellCheck={false}
                      />

                      <button
                        type="button"
                        onClick={() => onRemoveEditedLine(line.id)}
                        className="az-line-remove-button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
            </div>

            <div className="az-text-actions">
              <button type="button" onClick={onCopyText} className="az-secondary-button">
                Copy text
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="az-panel-header az-panel-header-wrap">
              <div>
                <div className="az-section-label">ORIGINAL PDF SETTINGS</div>
                <div className="az-section-copy">
                  Rotate, crop, and adjust brightness before downloading Original PDF.
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

            <div className="az-scan-edit-tools">
              <div className="az-tool-row">
                <span>PDF source</span>
                <div className="az-mini-toggle">
                  <button
                    type="button"
                    onClick={() => onImageEditChange({ ...imageEdit, pdfSource: "original" })}
                    className={imageEdit.pdfSource === "original" ? "az-mini-toggle-active" : ""}
                  >
                    Color
                  </button>
                  <button
                    type="button"
                    onClick={() => onImageEditChange({ ...imageEdit, pdfSource: "cleaned" })}
                    className={imageEdit.pdfSource === "cleaned" ? "az-mini-toggle-active" : ""}
                  >
                    Cleaned
                  </button>
                </div>
              </div>

              <div className="az-tool-row">
                <span>Rotate</span>
                <div className="az-mini-toggle">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() =>
                        onImageEditChange({
                          ...imageEdit,
                          rotate: deg as ImageEditSettings["rotate"],
                        })
                      }
                      className={imageEdit.rotate === deg ? "az-mini-toggle-active" : ""}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              <label className="az-range-row">
                <span>Brightness</span>
                <input
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={imageEdit.brightness}
                  onChange={(e) =>
                    onImageEditChange({
                      ...imageEdit,
                      brightness: Number(e.target.value),
                    })
                  }
                />
              </label>

              <div className="az-crop-grid">
                {(["top", "right", "bottom", "left"] as const).map((side) => (
                  <label key={side} className="az-crop-field">
                    <span>{side}</span>
                    <input
                      type="number"
                      min="0"
                      max="35"
                      value={imageEdit.crop[side]}
                      onChange={(e) => setCropSide(side, Number(e.target.value))}
                    />
                  </label>
                ))}
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
                  <div className="az-compare-label">Original / PDF Preview</div>
                  <div className="az-compare-frame">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Original document preview"
                        className="az-main-preview az-edit-preview-image"
                        style={rotationStyle}
                      />
                    ) : (
                      <div className="az-empty-note">Original preview is not available.</div>
                    )}
                  </div>
                </div>
              )}

              {(compareView === "split" || compareView === "cleaned") && (
                <div className="az-compare-panel">
                  <div className="az-compare-label">Cleaned OCR Preview</div>
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
  );
}