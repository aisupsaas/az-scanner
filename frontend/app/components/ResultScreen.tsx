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

export default function ResultScreen(props: ResultScreenProps) {
  const {
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
  } = props;

  const previewImage =
    imageEdit.pdfSource === "cleaned" && cleanedImageHref
      ? cleanedImageHref
      : originalImageHref || sourcePreview;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<null | "tl" | "tr" | "bl" | "br">(null);

  function cycleRotate() {
    const next = (imageEdit.rotate + 90) % 360;
    onImageEditChange({
      ...imageEdit,
      rotate: next as ImageEditSettings["rotate"],
    });
  }

  function handleDragStart(corner: typeof dragging) {
    setDragging(corner);
  }

  function handleDragMove(e: React.PointerEvent) {
    if (!dragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const crop = { ...imageEdit.crop };

    if (dragging === "tl") {
      crop.left = Math.min(Math.max(x, 0), 35);
      crop.top = Math.min(Math.max(y, 0), 35);
    }
    if (dragging === "tr") {
      crop.right = Math.min(Math.max(100 - x, 0), 35);
      crop.top = Math.min(Math.max(y, 0), 35);
    }
    if (dragging === "bl") {
      crop.left = Math.min(Math.max(x, 0), 35);
      crop.bottom = Math.min(Math.max(100 - y, 0), 35);
    }
    if (dragging === "br") {
      crop.right = Math.min(Math.max(100 - x, 0), 35);
      crop.bottom = Math.min(Math.max(100 - y, 0), 35);
    }

    onImageEditChange({
      ...imageEdit,
      crop,
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

  return (
    <div className="az-screen">
      <div className="az-result-tabs">
        <button onClick={() => onResultTabChange("compare")}>Scan</button>
        <button onClick={() => onResultTabChange("text")}>Text</button>
      </div>

      {resultTab === "text" ? (
        <div>
          <div className="az-line-editor-list">
            {editedLines.map((line, i) => (
              <div key={line.id} className="az-line-editor-row">
                <span>{i + 1}</span>
                <input
                  value={line.text}
                  onChange={(e) =>
                    onUpdateEditedLine(line.id, e.target.value)
                  }
                />
                <button onClick={() => onRemoveEditedLine(line.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button onClick={onCopyText}>Copy</button>
        </div>
      ) : (
        <div>
          {/* CONTROLS */}
          <div className="az-scan-controls">
            <button onClick={cycleRotate}>Rotate</button>

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
          </div>

          {/* IMAGE + CROP */}
          <div
            ref={containerRef}
            className="az-crop-container"
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerLeave={handleDragEnd}
          >
            <img
              src={previewImage}
              className="az-crop-image"
              style={{
                transform: `rotate(${imageEdit.rotate}deg)`,
                filter: `brightness(${imageEdit.brightness})`,
              }}
            />

            {/* DARK OVERLAY */}
            <div className="az-crop-overlay" />

            {/* CROP BOX */}
            <div className="az-crop-box" style={cropBoxStyle}>
              <div className="az-grid" />

              <div
                className="az-handle tl"
                onPointerDown={() => handleDragStart("tl")}
              />
              <div
                className="az-handle tr"
                onPointerDown={() => handleDragStart("tr")}
              />
              <div
                className="az-handle bl"
                onPointerDown={() => handleDragStart("bl")}
              />
              <div
                className="az-handle br"
                onPointerDown={() => handleDragStart("br")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}