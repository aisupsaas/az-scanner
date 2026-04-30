"use client";

export default function StartScreen(props: {
  onOpenCamera: () => void;
  onChooseFile: (file: File | null) => void;
}) {
  return (
    <div className="az-screen az-screen-center">
      <div className="az-hero-card">
        <div className="az-kicker">STANDARD OCR</div>

        <h1 className="az-hero-title">
          Scan documents and edit extracted text.
        </h1>

        <p className="az-hero-copy">
          Capture with the camera or upload an image, then review, extract, edit,
          and export your text.
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