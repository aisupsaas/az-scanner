"use client";

export default function ReviewScreen(props: {
  sourcePreview: string;
  error: string;
}) {
  return (
    <div className="az-screen">
      <div className="az-panel-card az-panel-card-fill">
        <div className="az-panel-header">
          <div>
            <div className="az-section-label">IMAGE REVIEW</div>
            <div className="az-section-copy">
              Confirm the captured or uploaded document before processing.
            </div>
          </div>
        </div>

        <div className="az-preview-stage">
          {props.sourcePreview ? (
            <img
              src={props.sourcePreview}
              alt="Selected document preview"
              className="az-main-preview"
            />
          ) : (
            <div className="az-empty-note">No image selected yet.</div>
          )}
        </div>

        {props.error ? (
          <div className="az-inline-error">
            <div className="az-inline-error-title">Load failed</div>
            <div className="az-inline-error-copy">{props.error}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}