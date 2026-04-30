"use client";

type CameraOverlayProps = {
  cameraLoading: boolean;
  cameraError: string;
  cameraReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
  onCapture: () => void;
};

export default function CameraOverlay({
  cameraLoading,
  cameraError,
  cameraReady,
  videoRef,
  canvasRef,
  onClose,
  onCapture,
}: CameraOverlayProps) {
  return (
    <div
      className="az-camera-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Camera capture"
    >
      <div className="az-camera-topbar">
        <button type="button" onClick={onClose} className="az-camera-top-button">
          Close
        </button>

        <div className="az-camera-title-wrap">
          <div className="az-camera-title">Scanner Camera</div>
          <div className="az-camera-subtitle">Align the document inside the frame</div>
        </div>

        <div className="az-camera-top-spacer" />
      </div>

      <div className="az-camera-viewport">
        {cameraLoading ? (
          <div className="az-camera-message">Opening camera...</div>
        ) : cameraError ? (
          <div className="az-camera-message az-camera-message-error">
            {cameraError}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="az-camera-video-full"
              playsInline
              muted
              autoPlay
            />
            <div className="az-camera-frame" />
          </>
        )}
      </div>

      <div className="az-camera-bottombar">
        <button type="button" onClick={onClose} className="az-camera-secondary">
          Cancel
        </button>

        <button
          type="button"
          onClick={onCapture}
          disabled={!cameraReady || cameraLoading}
          className="az-camera-shutter disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Capture"
        >
          <span className="az-camera-shutter-inner" />
        </button>

        <div className="az-camera-hint">Capture</div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}