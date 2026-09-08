import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { croppedBlobToFile, getCroppedImg } from "../utils/cropImage";

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.72)",
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

const panel = {
  background: "var(--bg-card, #111827)",
  border: "1px solid var(--border, #374151)",
  borderRadius: 8,
  padding: 14,
  maxWidth: 420,
  width: "100%",
  boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
};

const cropBox = {
  position: "relative",
  width: "100%",
  height: 280,
  background: "#0d1117",
  borderRadius: 6,
  overflow: "hidden",
};

const btn = {
  padding: "8px 14px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
  border: "none",
  fontFamily: "monospace",
};

/**
 * Square crop + zoom modal for account avatars.
 * @param {{ imageSrc: string, onCancel: () => void, onApply: (file: File) => void }} props
 */
export default function AvatarCropModal({ imageSrc, onCancel, onApply }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    setError(null);
    setBusy(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, 256);
      const file = croppedBlobToFile(blob, "avatar.jpg");
      onApply(file);
    } catch (err) {
      setError(
        err?.message ||
          "Upload the image to crop it.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <div
      role="presentation"
      style={overlay}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-label="Crop profile picture"
        style={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontWeight: "bold",
            color: "var(--accent, #a78bfa)",
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          Adjust profile picture
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted, #9ca3af)",
            marginBottom: 10,
            lineHeight: 1.45,
          }}
        >
          Drag to pan, use the slider to zoom. Apply frames a 256×256 square for
          upload.
        </div>
        <div style={cropBox}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
          />
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 12,
            fontSize: 11,
            color: "var(--text-muted, #9ca3af)",
          }}
        >
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
            aria-label="Zoom"
          />
        </label>
        {error ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "#f87171",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              ...btn,
              background: "transparent",
              color: "var(--text-muted, #9ca3af)",
              border: "1px solid var(--border, #374151)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || !croppedAreaPixels}
            style={{
              ...btn,
              background: "var(--accent, #7c3aed)",
              color: "#fff",
              opacity: busy || !croppedAreaPixels ? 0.6 : 1,
            }}
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
