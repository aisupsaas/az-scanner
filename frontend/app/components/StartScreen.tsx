"use client";

import type { PlanType } from "../types";

export default function StartScreen(props: {
  selectedPlan: PlanType;
  onSelectPlan: (plan: PlanType) => void;
  onOpenCamera: () => void;
  onChooseFiles: (files: FileList | File[] | null) => void;
}) {
  const isPro = props.selectedPlan === "pro";

  return (
    <div className="az-screen az-screen-center">
      <div className="az-hero-card">
        <div className="az-start-intro">
          <div className="az-kicker">{isPro ? "PRO OCR" : "STANDARD OCR"}</div>

          <h1 className="az-hero-title">
            {isPro
              ? "High-accuracy scans with smarter text cleanup."
              : "Scan documents and edit extracted text."}
          </h1>

          <p className="az-hero-copy">
            {isPro
              ? "Try Pro for cleaner extraction, smarter layout handling, and better document-ready text."
              : "Capture with the camera or upload an image, then review, extract, edit, and export your text."}
          </p>
        </div>

        <div className="az-home-plan-picker" aria-label="Choose scan plan">
          <button
            type="button"
            onClick={() => props.onSelectPlan("standard")}
            className={[
              "az-home-plan-card",
              props.selectedPlan === "standard" ? "az-home-plan-card-active" : "",
            ].join(" ")}
          >
            <span>Standard</span>
            <strong>Free</strong>
            <ul className="az-plan-features">
              <li>Free basic OCR</li>
              <li>Up to 10 images per scan</li>
              <li>Editable text</li>
              <li>TXT and PDF export</li>
            </ul>
          </button>

          <button
            type="button"
            onClick={() => props.onSelectPlan("pro")}
            className={[
              "az-home-plan-card",
              props.selectedPlan === "pro" ? "az-home-plan-card-active" : "",
            ].join(" ")}
          >
            <span>Pro</span>
            <strong>3-day trial</strong>
            <ul className="az-plan-features">
              <li>Document AI OCR (Optical Character Recognition)</li>
              <li>Unlimited total images</li>
              <li>Add up to 20 files per upload</li>
              <li>Better text accuracy</li>
              <li>Better document-ready extraction</li>
            </ul>
          </button>
        </div>

        <div className="az-start-icon-actions" aria-label="Start scan actions">
          <button
            type="button"
            onClick={props.onOpenCamera}
            className="az-start-camera-icon-button"
            aria-label="Open camera"
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8.5 7L9.8 5.3C10.1 4.9 10.6 4.7 11.1 4.7H12.9C13.4 4.7 13.9 4.9 14.2 5.3L15.5 7H18C19.1 7 20 7.9 20 9V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V9C4 7.9 4.9 7 6 7H8.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="12"
                cy="13"
                r="3.2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
          </button>

          <label className="az-start-file-icon-button" aria-label="Choose files">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6 3.8H13.5L18 8.3V20.2H6V3.8Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M13.5 3.8V8.3H18"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9 14H15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M12 11V17"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>

            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                props.onChooseFiles(e.target.files || null);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}