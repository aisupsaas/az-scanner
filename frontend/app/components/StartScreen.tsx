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
              "az-home-plan-card-standard",
              props.selectedPlan === "standard" ? "az-home-plan-card-active" : "",
            ].join(" ")}
          >
            <span>Standard</span>
            <strong>Free</strong>
            <ul className="az-plan-features">
              <li>Basic OCR extraction</li>
              <li>Up to 10 images per scan</li>
              <li>Edit extracted text</li>
              <li>Export TXT and PDF</li>
            </ul>
          </button>

          <button
            type="button"
            onClick={() => props.onSelectPlan("pro")}
            className={[
              "az-home-plan-card",
              "az-home-plan-card-pro",
              props.selectedPlan === "pro" ? "az-home-plan-card-active" : "",
            ].join(" ")}
          >
            <span>Pro</span>
            <strong>3-day trial</strong>
            <ul className="az-plan-features">
              <li>Document AI OCR</li>
              <li>Unlimited total images</li>
              <li>Add up to 20 files per upload</li>
              <li>Higher text accuracy</li>
              <li>Cleaner document-ready extraction</li>
              <li>Better layout handling</li>
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
              width="58"
              height="58"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect
                x="10"
                y="20"
                width="44"
                height="32"
                rx="9"
                stroke="currentColor"
                strokeWidth="3.4"
              />
              <path
                d="M24 20L27.5 14.8C28.25 13.65 29.55 13 30.9 13H34.1C35.45 13 36.75 13.65 37.5 14.8L41 20"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="32"
                cy="36"
                r="9"
                stroke="currentColor"
                strokeWidth="3.4"
              />
              <circle cx="47" cy="27" r="2.2" fill="currentColor" />
            </svg>
          </button>

          <label className="az-start-file-icon-button" aria-label="Choose files">
            <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 5V19"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <path
                  d="M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2.4"
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