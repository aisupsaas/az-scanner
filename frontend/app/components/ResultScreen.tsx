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
  smartCleanImageHref: string;
  result: ProcessResponse | null;
  loading: boolean;
  selectedPlan: PlanType;
  resultTab: ResultTab;
  compareView: CompareView;
  sourcePreview: string;
  originalImageHref: string;
  cleanedImageHref: string;
  editedText: string;
  pageTexts: string[];
  editedLines: OcrLine[];
  imageEdit: ImageEditSettings;
  activePageIndex: number;
  pageCount: number;
  canUndoText: boolean;
  onUpdateTextPage: (pageIndex: number, text: string) => void;
  onDeleteTextPage: (pageIndex: number) => void;
  onResetTextPages: () => void;
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
  pageTexts,
  editedLines,
  imageEdit,
  activePageIndex,
  pageCount,
  canUndoText,
  smartCleanImageHref,
  onUndoText,
  onResetOcrText,
  onSetEditedText,
  onUpdateTextPage,
  onDeleteTextPage,
  onResetTextPages,
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
    const smartCleanPreviewHref = smartCleanImageHref || cleanedImageHref || originalImageHref || sourcePreview;

const previewImage =
  imageEdit.pdfSource === "smartClean" && smartCleanPreviewHref
    ? smartCleanPreviewHref
    : imageEdit.pdfSource === "cleaned" && cleanedImageHref
      ? cleanedImageHref
      : originalImageHref || sourcePreview;
    
  const textPages = pageTexts?.length ? pageTexts : [editedText || ""];

  const textPageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const textScrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<Corner | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [textFontSize, setTextFontSize] = useState(16);
  const [editMode, setEditMode] = useState<"crop" | "zoom">("crop");
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const [pageDragFromIndex, setPageDragFromIndex] = useState<number | null>(null);
  const [pageDragOverIndex, setPageDragOverIndex] = useState<number | null>(null);

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

    function handlePanMove(e: React.PointerEvent) {
    if (editMode !== "zoom" || !panning) return;

    onImageEditChange({
      ...imageEdit,
      panX: panStart.panX + (e.clientX - panStart.x),
      panY: panStart.panY + (e.clientY - panStart.y),
      applied: false,
    });
  }

  function handlePanEnd() {
    setPanning(false);
  }

  const cropBoxStyle = {
    top: `${imageEdit.crop.top}%`,
    left: `${imageEdit.crop.left}%`,
    right: `${imageEdit.crop.right}%`,
    bottom: `${imageEdit.crop.bottom}%`,
  };

  const editedPreviewStyle = {
    transform: `translate(${imageEdit.panX ?? 0}px, ${imageEdit.panY ?? 0}px) rotate(${imageEdit.rotate}deg) scale(${imageEdit.zoom ?? 1})`,
    filter: `brightness(${imageEdit.brightness})`,
    clipPath: `inset(${imageEdit.crop.top}% ${imageEdit.crop.right}% ${imageEdit.crop.bottom}% ${imageEdit.crop.left}%)`,
  };


  return (
    <div className="az-screen">
      <div className="az-result-masthead">
        <div>
          <div className="az-result-title">Result</div>
        </div>
      </div>

      <div className="az-panel-card az-panel-card-fill">
        {resultTab === "text" ? (
          <>
            
  <div className="az-text-top-row">
    <div className="az-result-toggle">
      <button
        type="button"
        onClick={() => onResultTabChange("compare")}
      >
        Scan
      </button>

      <button
        type="button"
        onClick={() => onResultTabChange("text")}
        className="az-result-toggle-active"
      >
        Text
      </button>
    </div>

            <button
          type="button"
          onClick={applyScanEdit}
          className="az-scan-apply"
        >
          Apply
        </button>

        <span className="az-divider">|</span>

        <button
          type="button"
          onClick={onResetTextPages}
          className="az-scan-apply"
        >
          Reset
        </button>

  </div>

  {result?.warning ? (
    <div className="az-inline-error">
      <div className="az-inline-error-title">OCR warning</div>
      <div className="az-inline-error-copy">{result.warning}</div>
    </div>
  ) : null}

  <div className="az-page-strip az-text-page-strip">
    {textPages.map((_, index) => (
      <button
        key={index}
        type="button"
        onClick={() => {
          onSelectPage(index);

          const scroller = textScrollRef.current;
          const target = textPageRefs.current[index];

          if (!scroller || !target) return;

          scroller.scrollTo({
            top: target.offsetTop - scroller.offsetTop,
            behavior: "smooth",
          });
        }}
        className={[
          "az-page-pill",
          activePageIndex === index ? "az-page-pill-active" : "",
        ].join(" ")}
      >
        Page {index + 1}
      </button>
    ))}
  </div>

 <div ref={textScrollRef} className="az-text-a4-scroll">
  {textPages.map((pageText, index) => (
    <div
      key={index}
      ref={(node) => {
        textPageRefs.current[index] = node;
      }}
      className="az-text-a4-page"
    >
      <button
        type="button"
        className="az-text-page-delete"
        onClick={() => onDeleteTextPage(index)}
        aria-label={`Delete text page ${index + 1}`}
      >
        ×
      </button>

      <textarea
        value={pageText}
        disabled={loading}
        onFocus={() => onSelectPage(index)}
        onChange={(e) => onUpdateTextPage(index, e.target.value)}
        className="az-text-a4-editor"
        spellCheck={false}
        placeholder={`Page ${index + 1} text will appear here.`}
        style={{
          fontSize: `${textFontSize}px`,
        }}
      />
    </div>
  ))}
  </div>

          <div className="az-text-actions az-text-export-row">
            <button
              type="button"
              onClick={() => {
                setDownloadOpen((current) => !current);
              }}
              className="az-export-icon-minimal"
              aria-label="Download text"
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 20H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="az-text-font-controls">
              <button
                type="button"
                className="az-font-size-button"
                onClick={() => setTextFontSize((current) => Math.max(12, current - 1))}
              >
                A−
              </button>

              <div className="az-font-size-label">{textFontSize}px</div>

              <button
                type="button"
                className="az-font-size-button"
                onClick={() => setTextFontSize((current) => Math.min(28, current + 1))}
              >
                A+
              </button>
            </div>

            <button
              type="button"
              className="az-export-icon-minimal"
              aria-label="Share text"
              onClick={onShareEditedPdf}
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
          </>

        ) : (
          <>
            <div className="az-scan-settings-head">
              <div className="az-scan-settings-title-row">
                <div className="az-section-copy">
                  Page {activePageIndex + 1} of {pageCount} •{" "}
                  {imageEdit.applied ? "Saved" : "Unsaved changes"}
                </div>

                <div className="az-top-tools-row">
                  <button
                    type="button"
                    onClick={cycleRotate}
                    className="az-top-tool-button"
                  >
                    ↻
                  </button>

                  <span className="az-divider">|</span>

                  <button
                    type="button"
                    onClick={resetCrop}
                    className="az-top-tool-button"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="az-result-controls-row az-result-controls-row-centered">
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
                  >
                    Text
                  </button>
                </div>

                <button
                  type="button"
                  onClick={applyScanEdit}
                  className={[
                    "az-scan-apply",
                    imageEdit.applied ? "az-scan-apply-saved" : "",
                    !imageEdit.applied ? "az-scan-apply-pulse" : "",
                  ].join(" ")}
                >
                  {imageEdit.applied ? "Saved" : "Apply"}
                </button>

                <span className="az-divider">|</span>

                <button
                  type="button"
                  onClick={onApplyEditToAllPages}
                  className="az-scan-apply-all"
                >
                  All
                </button>
              </div>
            </div>

              <div className="az-page-strip">
                {Array.from({ length: pageCount }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    data-result-page-index={index}
                    onPointerDown={(e) => {
                      const startX = e.clientX;
                      let moved = false;

                      setPageDragFromIndex(index);

                      const handleMove = (moveEvent: PointerEvent) => {
                        if (Math.abs(moveEvent.clientX - startX) > 8) {
                          moved = true;

                          const target = document
                            .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
                            ?.closest("[data-result-page-index]");

                          const overIndex = Number(
                            target?.getAttribute("data-result-page-index")
                          );

                          if (
                            Number.isFinite(overIndex) &&
                            overIndex !== pageDragOverIndex
                          ) {
                            setPageDragOverIndex(overIndex);
                          }
                        }
                      };

                      const handleUp = () => {
                        window.removeEventListener("pointermove", handleMove);
                        window.removeEventListener("pointerup", handleUp);

                        if (
                          moved &&
                          pageDragFromIndex !== null &&
                          pageDragOverIndex !== null &&
                          pageDragFromIndex !== pageDragOverIndex
                        ) {
                          onMovePage(pageDragFromIndex, pageDragOverIndex);
                        } else {
                          onSelectPage(index);
                        }

                        setPageDragFromIndex(null);
                        setPageDragOverIndex(null);
                      };

                      window.addEventListener("pointermove", handleMove);
                      window.addEventListener("pointerup", handleUp);
                    }}
                    className={[
                      "az-page-pill",
                      "az-page-pill-draggable",
                      activePageIndex === index ? "az-page-pill-active" : "",
                      pageDragFromIndex === index
                        ? "az-page-pill-dragging"
                        : "",
                      pageDragOverIndex === index &&
                      pageDragFromIndex !== null
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

                 <div className="az-edit-mode-inline">
                      <button
                        type="button"
                        onClick={() => setEditMode("crop")}
                        className={[
                          "az-edit-mode-button",
                          editMode === "crop"
                            ? "az-edit-mode-button-active"
                            : "",
                        ].join(" ")}
                      >
                        Crop
                      </button>

                      <span className="az-divider">|</span>

                      <button
                        type="button"
                        onClick={() => setEditMode("zoom")}
                        className={[
                          "az-edit-mode-button",
                          editMode === "zoom"
                            ? "az-edit-mode-button-active"
                            : "",
                        ].join(" ")}
                      >
                        Zoom
                      </button>

                    </div>
                  <div
                      ref={containerRef}
                      className="az-crop-container"
                      onPointerMove={(e) => {
                        handleDragMove(e);
                        handlePanMove(e);
                      }}
                      onPointerUp={() => {
                        handleDragEnd();
                        handlePanEnd();
                      }}
                      onPointerCancel={() => {
                        handleDragEnd();
                        handlePanEnd();
                      }}
                      onPointerLeave={() => {
                        handleDragEnd();
                        handlePanEnd();
                      }}
                    >
                    {previewImage ? (
                      <div
                          className="az-crop-image-wrap"
                          onPointerDown={(e) => {
                            if (editMode !== "zoom") return;

                            e.currentTarget.setPointerCapture(e.pointerId);
                            setPanning(true);
                            setPanStart({
                              x: e.clientX,
                              y: e.clientY,
                              panX: imageEdit.panX ?? 0,
                              panY: imageEdit.panY ?? 0,
                            });
                          }}
                        >

                          <img
                            ref={imageRef}
                            src={previewImage}
                            alt="Original document preview"
                            className="az-crop-image"
                            style={{
                              transform: `translate(${imageEdit.panX ?? 0}px, ${imageEdit.panY ?? 0}px) scale(${imageEdit.zoom ?? 1})`,
                              filter: `brightness(${imageEdit.brightness})`,
                              cursor:
                                editMode === "zoom"
                                  ? (panning ? "grabbing" : "grab")
                                  : "crosshair",
                            }}
                          />
                        {editMode === "crop" ? (
                          <div className="az-crop-box" style={cropBoxStyle}>
                          <div className="az-grid" />
                          <div className="az-handle tl" onPointerDown={(e) => handleDragStart("tl", e)} />
                          <div className="az-handle tr" onPointerDown={(e) => handleDragStart("tr", e)} />
                          <div className="az-handle bl" onPointerDown={(e) => handleDragStart("bl", e)} />
                          <div className="az-handle br" onPointerDown={(e) => handleDragStart("br", e)} />
                              </div>
                              ) : (
                                <div className="az-zoom-overlay">
                                  <button
                                    type="button"
                                    className="az-zoom-button"
                                    onClick={() =>
                                      onImageEditChange({
                                        ...imageEdit,
                                        zoom: Math.max(0.7, (imageEdit.zoom ?? 1) - 0.1),
                                        panX: imageEdit.panX ?? 0,
                                        panY: imageEdit.panY ?? 0,
                                        applied: false,
                                      })
                                    }
                                  >
                                    −
                                  </button>

                                  <button
                                    type="button"
                                    className="az-zoom-button"
                                    onClick={() =>
                                      onImageEditChange({
                                        ...imageEdit,
                                        zoom: Math.min(2, (imageEdit.zoom ?? 1) + 0.1),
                                        panX: imageEdit.panX ?? 0,
                                        panY: imageEdit.panY ?? 0,
                                        applied: false,
                                      })
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                      </div>
                    ) : (
                      <div className="az-empty-note">Original preview is not available.</div>
                    )}
                  </div>
                </div>
              )}

              {compareView === "split" && (
                <div className="az-compare-panel">
                  <div className="az-preview-head-row">

                  <div className="az-compare-label">
                    Preview
                  </div>

                  {smartCleanPreviewHref ? (
                    <div className="az-result-toggle az-smart-clean-toggle az-smart-clean-toggle-preview">

                      <button
                        type="button"
                        onClick={() =>
                          onImageEditChange({
                            ...imageEdit,
                            pdfSource: "original",
                            applied: false,
                          })
                        }
                        className={
                          imageEdit.pdfSource !== "smartClean"
                            ? "az-result-toggle-active"
                            : ""
                        }
                      >
                        Original
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onImageEditChange({
                            ...imageEdit,
                            pdfSource: "smartClean",
                            applied: false,
                          })
                        }
                        className={
                          imageEdit.pdfSource === "smartClean"
                            ? "az-result-toggle-active"
                            : ""
                        }
                      >
                        Smart Clean
                      </button>

                    </div>
                  ) : null}

                </div>

                  <div className="az-compare-frame az-a4-preview-frame">
                      {previewImage ? (
                        <div className="az-a4-page-guide">
                          <div className="az-a4-size-label az-a4-width-label">8.5 in</div>
                          <div className="az-a4-size-label az-a4-height-label">11 in</div>

                          <div className="az-a4-print-guide az-a4-print-guide-top" />
                          <div className="az-a4-print-guide az-a4-print-guide-right" />
                          <div className="az-a4-print-guide az-a4-print-guide-bottom" />
                          <div className="az-a4-print-guide az-a4-print-guide-left" />

                          <img
                            src={previewImage}
                            alt="Edited scan preview"
                            className="az-main-preview az-a4-preview-image"
                            style={editedPreviewStyle}
                          />
                        </div>
                      ) : (
                        <div className="az-empty-note">Preview is not available.</div>
                      )}
                    </div>
                </div>
              )}
            </div>

      <div className="az-export-zone">
        <div className="az-bottom-export-row">
          <button
            type="button"
            onClick={() => {
                setDownloadOpen((current) => !current);
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
          className="az-export-icon-minimal"
          aria-label="Share"
          onClick={onShareOriginalPdf}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 16V5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M8 9L12 5L16 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6 13V18C6 18.5523 6.44772 19 7 19H17C17.5523 19 18 18.5523 18 18V13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
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
          </div>
               </>
        )}
      </div>
    </div>
  );
}