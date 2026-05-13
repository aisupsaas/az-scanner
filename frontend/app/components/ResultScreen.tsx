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
}: ResultScreenProps) {
  const previewImage =
    imageEdit.pdfSource === "cleaned" && cleanedImageHref
      ? cleanedImageHref
      : originalImageHref || sourcePreview;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<Corner | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [pageDragFromIndex, setPageDragFromIndex] = useState<number | null>(null);
  const [pageDragOverIndex, setPageDragOverIndex] = useState<number | null>(null);
  const pageHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function clearPageHoldTimer() {
  if (pageHoldTimerRef.current) {
    clearTimeout(pageHoldTimerRef.current);
    pageHoldTimerRef.current = null;
  }
}

function startPageHold(index: number) {
  clearPageHoldTimer();

  pageHoldTimerRef.current = setTimeout(() => {
    setPageDragFromIndex(index);
    setPageDragOverIndex(index);
  }, 260);
}

function finishPageHold(e: React.PointerEvent, index: number) {
  clearPageHoldTimer();

  if (pageDragFromIndex === null) {
    onSelectPage(index);
    return;
  }

  const target = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest("[data-result-page-index]");

  const toIndexRaw = target?.getAttribute("data-result-page-index");
  const toIndex = Number(toIndexRaw);

  if (
    Number.isFinite(toIndex) &&
    toIndex >= 0 &&
    toIndex < pageCount &&
    toIndex !== pageDragFromIndex
  ) {
    onMovePage(pageDragFromIndex, toIndex);
  }

  setPageDragFromIndex(null);
  setPageDragOverIndex(null);
}

  return (
    <div className="az-screen">
      <div className="az-result-masthead">
        <div>
          <div className="az-result-title">Result</div>
          <div className="az-result-subtitle">
            Page {activePageIndex + 1} of {pageCount} •{" "}
            {imageEdit.applied ? "Saved" : "Unsaved"}
          </div>
        </div>

        <div className="az-result-toggle">
          <button
            type="button"
            onClick={() => onResultTabChange("compare")}
            className={resultTab === "compare" ? "az-result-toggle-active" : ""}
          >
            Scan
          </button>

          <button
            type="button"
            onClick={() => onResultTabChange("text")}
            className={resultTab === "text" ? "az-result-toggle-active" : ""}
          >
            Text
          </button>
        </div>
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

              <div className="az-text-tool-row">
                <button type="button" onClick={() => onApplyTextTool("clean")} className="az-text-tool-button">
                  Smart clean
                </button>

                <button type="button" onClick={() => onApplyTextTool("spacing")} className="az-text-tool-button">
                  Spacing
                </button>

                <button type="button" onClick={() => onApplyTextTool("blankLines")} className="az-text-tool-button">
                  Lines
                </button>

                <button type="button" onClick={() => onApplyTextTool("mergeLines")} className="az-text-tool-button">
                  Merge
                </button>

                <button type="button" onClick={onUndoText} disabled={!canUndoText} className="az-text-tool-button az-text-tool-button-soft">
                  Undo
                </button>

                <button type="button" onClick={onResetOcrText} className="az-text-tool-button az-text-tool-button-soft">
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
                  value={loading ? "Processing document..." : editedText || "Your extracted text will appear here."}
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
            <div className="az-scan-settings-head">
              <div>
                <div className="az-section-label">ORIGINAL PDF SETTINGS</div>
                <div className="az-section-copy">
                  Page {activePageIndex + 1} of {pageCount} • {imageEdit.applied ? "Saved" : "Unsaved changes"}
                </div>
              </div>

              <div className="az-result-toggle az-scan-mode-toggle">
                <button
                  type="button"
                  onClick={() => onCompareViewChange("split")}
                  className={compareView === "split" ? "az-result-toggle-active" : ""}
                >
                  Preview
                </button>

                <button
                  type="button"
                  onClick={() => onCompareViewChange("original")}
                  className={compareView === "original" ? "az-result-toggle-active" : ""}
                >
                  Edit
                </button>
              </div>

              <div className="az-result-toggle az-scan-source-toggle">
                <button
                  type="button"
                  onClick={() =>
                    onImageEditChange({
                      ...imageEdit,
                      pdfSource: "original",
                      applied: false,
                    })
                  }
                  className={imageEdit.pdfSource === "original" ? "az-result-toggle-active" : ""}
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
                  className={imageEdit.pdfSource === "cleaned" ? "az-result-toggle-active" : ""}
                >
                  Cleaned
                </button>
              </div>
            </div>

              <div className="az-page-strip">
                {Array.from({ length: pageCount }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    data-result-page-index={index}
                    onPointerDown={() => startPageHold(index)}
                    onPointerMove={(e) => {
                      if (pageDragFromIndex === null) return;

                      const target = document
                        .elementFromPoint(e.clientX, e.clientY)
                        ?.closest("[data-result-page-index]");

                      const overIndex = Number(target?.getAttribute("data-result-page-index"));

                      if (Number.isFinite(overIndex)) {
                        setPageDragOverIndex(overIndex);
                      }
                    }}
                    onPointerUp={(e) => finishPageHold(e, index)}
                    onPointerCancel={() => {
                      clearPageHoldTimer();
                      setPageDragFromIndex(null);
                      setPageDragOverIndex(null);
                    }}
                    className={[
                      "az-page-pill",
                      "az-page-pill-draggable",
                      activePageIndex === index ? "az-page-pill-active" : "",
                      pageDragFromIndex === index ? "az-page-pill-dragging" : "",
                      pageDragOverIndex === index && pageDragFromIndex !== null
                        ? "az-page-pill-drop-target"
                        : "",
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

                          <div className="az-handle tl" onPointerDown={(e) => handleDragStart("tl", e)} />
                          <div className="az-handle tr" onPointerDown={(e) => handleDragStart("tr", e)} />
                          <div className="az-handle bl" onPointerDown={(e) => handleDragStart("bl", e)} />
                          <div className="az-handle br" onPointerDown={(e) => handleDragStart("br", e)} />
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

            <div className="az-scan-toolbar">
              <div className="az-scan-button-row">
                <button type="button" onClick={cycleRotate} className="az-scan-icon-button" aria-label="Rotate page">
                  ↻
                </button>

                <button type="button" onClick={resetCrop} className="az-scan-compact-button">
                  Reset
                </button>

                <button
                  type="button"
                  onClick={applyScanEdit}
                  className={imageEdit.applied ? "az-scan-apply az-scan-apply-saved" : "az-scan-apply"}
                >
                  {imageEdit.applied ? "Saved" : "Apply"}
                </button>

                <button type="button" onClick={onApplyEditToAllPages} className="az-scan-apply-all">
                  All
                </button>
              </div>
            </div>

      <div className="az-export-zone">
  <div className="az-bottom-export-row">
    <button
      type="button"
      onClick={() => {
        setDownloadOpen((current) => !current);
        setShareOpen(false);
      }}
      className="az-export-icon-minimal"
      aria-label="Download"
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 20H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>

    <label className="az-scan-brightness az-scan-brightness-bottom">
      <span className="az-brightness-icon-small">☀</span>
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
      <span className="az-brightness-icon-big">☀</span>
    </label>

    <button
      type="button"
      onClick={() => {
        setShareOpen((current) => !current);
        setDownloadOpen(false);
      }}
      className="az-export-icon-minimal"
      aria-label="Share"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 13V18C6 18.5523 6.44772 19 7 19H17C17.5523 19 18 18.5523 18 18V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  </div>

  {downloadOpen ? (
    <div className="az-export-drawer">
      <button type="button" onClick={onDownloadOriginalPdf}>
        <span>PDF</span>
        <small>Adobe PDF</small>
      </button>

      <button type="button" onClick={onDownloadEditedTxt}>
        <span>TXT</span>
        <small>Text TXT</small>
      </button>

      <button type="button" onClick={onDownloadEditedPdf}>
        <span>PDF</span>
        <small>Text PDF</small>
      </button>

      <button type="button" onClick={onDownloadEditedDocx}>
        <span>DOCX</span>
        <small>Word DOCX</small>
      </button>
    </div>
  ) : null}

  {shareOpen ? (
    <div className="az-export-drawer">
      <button type="button" onClick={onShareOriginalPdf}>
        <span>PDF</span>
        <small>Original</small>
      </button>

      <button type="button" onClick={onShareEditedTxt}>
        <span>TXT</span>
        <small>Text TXT</small>
      </button>

      <button type="button" onClick={onShareEditedPdf}>
        <span>PDF</span>
        <small>Text PDF</small>
      </button>

      <button type="button" onClick={onShareEditedDocx}>
        <span>DOCX</span>
        <small>Word DOCX</small>
      </button>
    </div>
  ) : null}
</div>
          </>
        )}
      </div>
    </div>
  );
}