"use client";

import { useRef, useState } from "react";

import type {
  CompareView,
  ImageEditSettings,
  OcrLine,
  ProcessResponse,
  ResultTab,
  PlanType,
} from "../types";

type TextTool = "clean" | "spacing" | "blankLines" | "mergeLines";
type Corner = "tl" | "tr" | "bl" | "br";

type ResultScreenProps = {
  result: ProcessResponse | null;
  loading: boolean;
  selectedPlan: PlanType;
  resultTab: ResultTab;
  compareView: CompareView;
  sourcePreview: string;
  originalImageHref: string;
  cleanedImageHref: string;
  editedText: string;
  editedLines: OcrLine[];
  imageEdit: ImageEditSettings;
  activePageIndex: number;
  pageCount: number;
  canUndoText: boolean;
  onUndoText: () => void;
  onResetOcrText: () => void;
  onSetEditedText: (text: string) => void;
  onUpdateEditedLine: (id: string, text: string) => void;
  onRemoveEditedLine: (id: string) => void;
  onCopyText: () => void | Promise<void>;
  onDownloadOriginalPdf: () => void | Promise<void>;
  onDownloadEditedTxt: () => void | Promise<void>;
  onDownloadEditedPdf: () => void | Promise<void>;
  onShareOriginalPdf: () => void | Promise<void>;
  onShareEditedTxt: () => void | Promise<void>;
  onShareEditedPdf: () => void | Promise<void>;
  onDownloadEditedDocx: () => void | Promise<void>;
  onShareEditedDocx: () => void | Promise<void>;
  onApplyTextTool: (tool: TextTool) => void;
  onImageEditChange: (settings: ImageEditSettings) => void;
  onApplyEditToAllPages: () => void;
  onSelectPage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onResultTabChange: (tab: ResultTab) => void;
  onCompareViewChange: (view: CompareView) => void;
};

export default function ResultScreen({
  result,
  loading,
  resultTab,
  compareView,
  selectedPlan,
  sourcePreview,
  originalImageHref,
  cleanedImageHref,
  editedText,
  editedLines,
  imageEdit,
  activePageIndex,
  pageCount,
  canUndoText,
  onUndoText,
  onResetOcrText,
  onSetEditedText,
  onUpdateEditedLine,
  onRemoveEditedLine,
  onCopyText,
  onDownloadOriginalPdf,
  onDownloadEditedTxt,
  onDownloadEditedPdf,
  onShareOriginalPdf,
  onShareEditedTxt,
  onShareEditedPdf,
  onDownloadEditedDocx,
  onShareEditedDocx,
  onApplyTextTool,
  onImageEditChange,
  onApplyEditToAllPages,
  onSelectPage,
  onMovePage,
  onResultTabChange,
  onCompareViewChange,
}: 

ResultScreenProps) {
  const previewImage =
    imageEdit.pdfSource === "cleaned" && cleanedImageHref
      ? cleanedImageHref
      : originalImageHref || sourcePreview;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<Corner | null>(null);
  const [exportOpen, setExportOpen] = useState(true);

  function cycleRotate() {
    const next = ((imageEdit.rotate + 90) % 360) as ImageEditSettings["rotate"];
    onImageEditChange({
      ...imageEdit,
      rotate: next,
      applied: false,
    });
  }

  function resetCrop() {
    onImageEditChange({
      ...imageEdit,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      applied: false,
    });
  }

  function applyScanEdit() {
    onImageEditChange({
      ...imageEdit,
      applied: true,
    });
  }

  function handleDragStart(corner: Corner, e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(corner);
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!dragging || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const safeX = Math.max(0, Math.min(100, x));
    const safeY = Math.max(0, Math.min(100, y));

    const crop = { ...imageEdit.crop };

    if (dragging === "tl") {
      crop.left = Math.min(Math.max(safeX, 0), 35);
      crop.top = Math.min(Math.max(safeY, 0), 35);
    }

    if (dragging === "tr") {
      crop.right = Math.min(Math.max(100 - safeX, 0), 35);
      crop.top = Math.min(Math.max(safeY, 0), 35);
    }

    if (dragging === "bl") {
      crop.left = Math.min(Math.max(safeX, 0), 35);
      crop.bottom = Math.min(Math.max(100 - safeY, 0), 35);
    }

    if (dragging === "br") {
      crop.right = Math.min(Math.max(100 - safeX, 0), 35);
      crop.bottom = Math.min(Math.max(100 - safeY, 0), 35);
    }

    onImageEditChange({
      ...imageEdit,
      crop,
      applied: false,
    });
  }

  function handleDragEnd() {
    setDragging(null);
  }

  const cropBoxStyle = {
    top: `${imageEdit.crop.top}%`,
    left: `${imageEdit.crop.left}%`,
    right: `${imageEdit.crop.right}%`,
    bottom: `${imageEdit.crop.bottom}%`,
  };

  const editedPreviewStyle = {
    transform: `rotate(${imageEdit.rotate}deg)`,
    filter: `brightness(${imageEdit.brightness})`,
    clipPath: `inset(${imageEdit.crop.top}% ${imageEdit.crop.right}% ${imageEdit.crop.bottom}% ${imageEdit.crop.left}%)`,
  };

  return (
    <div className="az-screen">
      <div className="az-result-tabs">
        <button
          type="button"
          onClick={() => onResultTabChange("compare")}
          className={["az-tab-button", resultTab === "compare" ? "az-tab-button-active" : ""].join(" ")}
        >
          Scan
        </button>

        <button
          type="button"
          onClick={() => onResultTabChange("text")}
          className={["az-tab-button", resultTab === "text" ? "az-tab-button-active" : ""].join(" ")}
        >
          Text
        </button>
      </div>

      <div className="az-panel-card az-panel-card-fill">

      <div className="az-export-card">
  <div className="az-export-head">
    <div>
      <div className="az-section-label">EXPORT</div>
      <div className="az-section-copy">
        {exportOpen
          ? "Choose a format, then download or share it."
          : "4 formats available."}
      </div>
    </div>

    <button
      type="button"
      onClick={() => setExportOpen((current) => !current)}
      className="az-export-collapse-button"
    >
      {exportOpen ? "Hide" : "Show"}
    </button>
  </div>

    {exportOpen ? (
      <div className="az-export-list">
        <div className="az-export-row">
          <div className="az-export-info">
            <span className="az-format-badge az-format-badge-pdf">PDF</span>
            <div>
              <div className="az-export-title">Original PDF</div>
              <div className="az-export-subtitle">Edited scan pages</div>
            </div>
          </div>

          <div className="az-export-actions">
            <button type="button" onClick={onDownloadOriginalPdf} className="az-export-action-button">
              Download
            </button>
            <button type="button" onClick={onShareOriginalPdf} className="az-export-icon-button" aria-label="Share Original PDF">
              ↗
            </button>
          </div>
        </div>

        <div className="az-export-row">
          <div className="az-export-info">
            <span className="az-format-badge az-format-badge-txt">TXT</span>
            <div>
              <div className="az-export-title">Text TXT</div>
              <div className="az-export-subtitle">Plain editable text</div>
            </div>
          </div>

          <div className="az-export-actions">
            <button type="button" onClick={onDownloadEditedTxt} className="az-export-action-button">
              Download
            </button>
            <button type="button" onClick={onShareEditedTxt} className="az-export-icon-button" aria-label="Share Text TXT">
              ↗
            </button>
          </div>
        </div>

        <div className="az-export-row">
          <div className="az-export-info">
            <span className="az-format-badge az-format-badge-pdf">PDF</span>
            <div>
              <div className="az-export-title">Text PDF</div>
              <div className="az-export-subtitle">Clean text document</div>
            </div>
          </div>

          <div className="az-export-actions">
            <button type="button" onClick={onDownloadEditedPdf} className="az-export-action-button">
              Download
            </button>
            <button type="button" onClick={onShareEditedPdf} className="az-export-icon-button" aria-label="Share Text PDF">
              ↗
            </button>
          </div>
        </div>

        <div className="az-export-row">
          <div className="az-export-info">
            <span className="az-format-badge az-format-badge-word">W</span>
            <div>
              <div className="az-export-title">Word DOCX</div>
              <div className="az-export-subtitle">Microsoft Word format</div>
            </div>
          </div>

          <div className="az-export-actions">
            <button type="button" onClick={onDownloadEditedDocx} className="az-export-action-button">
              Download
            </button>
            <button type="button" onClick={onShareEditedDocx} className="az-export-icon-button" aria-label="Share Word DOCX">
              ↗
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </div>

        {resultTab === "text" ? (
          <>
            <div className="az-panel-header az-panel-header-wrap">
              <div>
                <div className="az-section-label">EDITABLE TEXT</div>
                <div className="az-section-copy">
                  Edit detected lines, remove bad OCR guesses, then export TXT or Text PDF.
                </div>
              </div>
            <div className="az-text-tool-row">
              <button
                type="button"
                onClick={() => onApplyTextTool("clean")}
                className="az-text-tool-button"
              >
                Smart clean
              </button>

              <button
                type="button"
                onClick={() => onApplyTextTool("spacing")}
                className="az-text-tool-button"
              >
                Spacing
              </button>

              <button
                type="button"
                onClick={() => onApplyTextTool("blankLines")}
                className="az-text-tool-button"
              >
                Lines
              </button>

              <button
                type="button"
                onClick={() => onApplyTextTool("mergeLines")}
                className="az-text-tool-button"
              >
                Merge
              </button>

              <button
                type="button"
                onClick={onUndoText}
                disabled={!canUndoText}
                className="az-text-tool-button az-text-tool-button-soft"
              >
                Undo
              </button>

              <button
                type="button"
                onClick={onResetOcrText}
                className="az-text-tool-button az-text-tool-button-soft"
              >
                Reset OCR
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

                      <textarea
                        value={line.text}
                        onChange={(e) => onUpdateEditedLine(line.id, e.target.value)}
                        className="az-line-editor-input"
                        spellCheck={false}
                        rows={3}
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
                  Page {activePageIndex + 1} of {pageCount} • {imageEdit.applied ? "Saved" : "Unsaved changes"}
                </div>
              </div>

              <div className="az-compare-toggle">
                <button
                  type="button"
                  onClick={() => onCompareViewChange("split")}
                  className={["az-segment-button", compareView === "split" ? "az-segment-button-active" : ""].join(" ")}
                >
                  Edit + Preview
                </button>
                <button
                  type="button"
                  onClick={() => onCompareViewChange("original")}
                  className={["az-segment-button", compareView === "original" ? "az-segment-button-active" : ""].join(" ")}
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="az-page-strip">
              {Array.from({ length: pageCount }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  draggable
                  onClick={() => onSelectPage(index)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(index));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isFinite(fromIndex)) {
                      onMovePage(fromIndex, index);
                    }
                  }}
                  className={[
                    "az-page-pill",
                    "az-page-pill-draggable",
                    activePageIndex === index ? "az-page-pill-active" : "",
                  ].join(" ")}
                >
                  Page {index + 1}
                </button>
              ))}
            </div>

            <div
              className={[
                "az-compare-stage",
                compareView === "split" ? "az-compare-stage-split" : "",
              ].join(" ")}
              >
              {(compareView === "split" || compareView === "original") && (
                <div className="az-compare-panel">
                  <div className="az-compare-label">Edit crop</div>
                  <div
                    ref={containerRef}
                    className="az-crop-container"
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    onPointerLeave={handleDragEnd}
                  >
                    {previewImage ? (
                      <div className="az-crop-image-wrap">
                        <img
                          ref={imageRef}
                          src={previewImage}
                          alt="Original document preview"
                          className="az-crop-image"
                          style={{
                            transform: `rotate(${imageEdit.rotate}deg)`,
                            filter: `brightness(${imageEdit.brightness})`,
                          }}
                        />

                        <div className="az-crop-box" style={cropBoxStyle}>
                          <div className="az-grid" />

                          <div
                            className="az-handle tl"
                            onPointerDown={(e) => handleDragStart("tl", e)}
                          />
                          <div
                            className="az-handle tr"
                            onPointerDown={(e) => handleDragStart("tr", e)}
                          />
                          <div
                            className="az-handle bl"
                            onPointerDown={(e) => handleDragStart("bl", e)}
                          />
                          <div
                            className="az-handle br"
                            onPointerDown={(e) => handleDragStart("br", e)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="az-empty-note">Original preview is not available.</div>
                    )}
                  </div>
                </div>
              )}

              {compareView === "split" && (
                <div className="az-compare-panel">
                  <div className="az-compare-label">Preview</div>
                  <div className="az-compare-frame">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Edited scan preview"
                        className="az-main-preview"
                        style={editedPreviewStyle}
                      />
                    ) : (
                      <div className="az-empty-note">Preview is not available.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="az-scan-controls">
              <div className="az-edit-row">
                <button type="button" onClick={cycleRotate}>
                  Rotate
                </button>

                <button type="button" onClick={resetCrop}>
                  Reset crop
                </button>
              </div>

              <label className="az-brightness-control">
                Brightness
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
                      applied: false,
                    })
                  }
                />
              </label>

              <div className="az-mini-toggle">
                <button
                  type="button"
                  onClick={() =>
                    onImageEditChange({
                      ...imageEdit,
                      pdfSource: "original",
                      applied: false,
                    })
                  }
                  className={imageEdit.pdfSource === "original" ? "az-mini-toggle-active" : ""}
                >
                  Color
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onImageEditChange({
                      ...imageEdit,
                      pdfSource: "cleaned",
                      applied: false,
                    })
                  }
                  className={imageEdit.pdfSource === "cleaned" ? "az-mini-toggle-active" : ""}
                >
                  Cleaned
                </button>
              </div>

              <div className="az-apply-row">
              <button
                type="button"
                onClick={applyScanEdit}
                className={imageEdit.applied ? "az-apply-button az-apply-button-saved" : "az-apply-button"}
              >
                {imageEdit.applied ? "Saved" : "Apply"}
              </button>

              <button
                type="button"
                onClick={onApplyEditToAllPages}
                className="az-apply-all-button"
              >
                Apply to all
              </button>
            </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}