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
            <div
              key={preview}
              className={[
                "az-page-thumb-wrap",
                props.activePageIndex === index ? "az-page-thumb-wrap-active" : "",
              ].join(" ")}
            >
              <button
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

              <button
                type="button"
                onClick={() => props.onRemovePage(index)}
                className="az-thumb-trash"
                aria-label={`Remove page ${index + 1}`}
              >
                <svg
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M3 6H21"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <path
    d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <path
    d="M19 6L18.133 18.142C18.0579 19.1939 17.182 20 16.1275 20H7.87253C6.81803 20 5.94211 19.1939 5.86698 18.142L5 6"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <path
    d="M10 11V16"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <path
    d="M14 11V16"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
</svg>
              </button>
            </div>
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