"use client";

import { useRef, useState } from "react";
import type {
  CompareView,
  ImageEditSettings,
  OcrLine,
  ProcessResponse,
  ResultTab,
} from "../types";

type TextTool = "clean" | "spacing" | "blankLines" | "mergeLines";
type Corner = "tl" | "tr" | "bl" | "br";

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
  activePageIndex: number;
  pageCount: number;
  onSetEditedText: (text: string) => void;
  onUpdateEditedLine: (id: string, text: string) => void;
  onRemoveEditedLine: (id: string) => void;
  onCopyText: () => void | Promise<void>;
  onApplyTextTool: (tool: TextTool) => void;
  onImageEditChange: (settings: ImageEditSettings) => void;
  onSelectPage: (index: number) => void;
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
  onSetEditedText,
  onUpdateEditedLine,
  onRemoveEditedLine,
  onCopyText,
  onApplyTextTool,
  onImageEditChange,
  onSelectPage,
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
                  Page {activePageIndex + 1} of {pageCount}. Edit each page, then Apply before downloading.
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
                <button
                  type="button"
                  onClick={() => onCompareViewChange("cleaned")}
                  className={["az-segment-button", compareView === "cleaned" ? "az-segment-button-active" : ""].join(" ")}
                >
                  Cleaned OCR Preview
                </button>
              </div>
            </div>

            <div className="az-page-strip">
              {Array.from({ length: pageCount }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectPage(index)}
                  className={[
                    "az-page-pill",
                    activePageIndex === index ? "az-page-pill-active" : "",
                  ].join(" ")}
                >
                  Page {index + 1}
                </button>
              ))}
            </div>

            <div className="az-scan-controls">
              <button type="button" onClick={cycleRotate}>
                Rotate
              </button>

              <button type="button" onClick={resetCrop}>
                Reset crop
              </button>

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

              <button
                type="button"
                onClick={applyScanEdit}
                className={imageEdit.applied ? "az-apply-button az-apply-button-done" : "az-apply-button"}
              >
                {imageEdit.applied ? "Applied" : "Apply"}
              </button>
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

              {compareView === "cleaned" && (
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