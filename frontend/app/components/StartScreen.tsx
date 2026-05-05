"use client";

import type { PlanType } from "../types";

export default function StartScreen(props: {
  selectedPlan: PlanType;
  onSelectPlan: (plan: PlanType) => void;
  onOpenCamera: () => void;
  onChooseFile: (file: File | null) => void;
}) {
  const isPro = props.selectedPlan === "pro";

  return (
    <div className="az-screen az-screen-center">
      <div className="az-hero-card">
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

        <div className="az-kicker">
          {isPro ? "PRO OCR" : "STANDARD OCR"}
        </div>

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

        <div className="az-start-actions">
          <button
            type="button"
            onClick={props.onOpenCamera}
            className="az-primary-button"
          >
            Open camera
          </button>

          <label className="az-secondary-button az-file-label">
            Choose file
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/tiff,image/heic,image/heif"
              className="hidden"
              onChange={(e) => props.onChooseFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}