"use client";

import type { PlanType } from "../types";

export default function ReviewScreen(props: {
  selectedPlan: PlanType;
  sourcePreviews: string[];
  activePageIndex: number;
  error: string;
  onSelectPage: (index: number) => void;
  onRemovePage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
}) {
  const activePreview = props.sourcePreviews[props.activePageIndex] || "";
  const canMoveLeft = props.activePageIndex > 0;
  const canMoveRight = props.activePageIndex < props.sourcePreviews.length - 1;

  return (
    <div className="az-screen">
      <div className="az-panel-card az-panel-card-fill">
        <div className="az-panel-header">
          <div>
            <div className="az-section-label">IMAGE REVIEW</div>
            <div className="az-section-copy">
              {props.selectedPlan === "pro"
                ? "Review your uploaded pages. All pages will combine into one Original PDF."
                : "Review up to 10 images. All pages will combine into one Original PDF."}
            </div>
          </div>
        </div>

        <div className="az-page-strip">
          {props.sourcePreviews.map((preview, index) => (
            <button
              key={preview}
              type="button"
              onClick={() => props.onSelectPage(index)}
              className={[
                "az-page-thumb",
                props.activePageIndex === index ? "az-page-thumb-active" : "",
              ].join(" ")}
            >
              <img src={preview} alt={`Page ${index + 1}`} />
              <span>{index + 1}</span>
            </button>
          ))}
        </div>

        <div className="az-preview-stage">
          {activePreview ? (
            <img
              src={activePreview}
              alt="Selected document preview"
              className="az-main-preview"
            />
          ) : (
            <div className="az-empty-note">No image selected yet.</div>
          )}
        </div>

        {activePreview ? (
          <div className="az-review-actions">
            <button
              type="button"
              onClick={() => props.onMovePage(props.activePageIndex, props.activePageIndex - 1)}
              disabled={!canMoveLeft}
              className="az-review-move-button"
            >
              ← Move left
            </button>

            <button
              type="button"
              onClick={() => props.onMovePage(props.activePageIndex, props.activePageIndex + 1)}
              disabled={!canMoveRight}
              className="az-review-move-button"
            >
              Move right →
            </button>

            <button
              type="button"
              onClick={() => props.onRemovePage(props.activePageIndex)}
              className="az-remove-page-button"
            >
              Remove page
            </button>
          </div>
        ) : null}

        {props.error ? (
          <div className="az-inline-error">
            <div className="az-inline-error-title">Warning!</div>
            <div className="az-inline-error-copy">{props.error}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}