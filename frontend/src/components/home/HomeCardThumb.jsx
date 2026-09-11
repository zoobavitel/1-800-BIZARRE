import React, { useEffect, useState } from "react";

const SAFE_DATA_IMAGE_SRC =
  /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

function sanitizeImageSrc(src) {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) return value;
  if (SAFE_DATA_IMAGE_SRC.test(value)) return value;
  return "";
}

/**
 * Fixed-size portrait slot; placeholder initial when missing/broken.
 * Pass a CSS class for sizing (e.g. g-card-thumb); parent owns layout styles.
 */
export default function HomeCardThumb({ src, label, className, style }) {
  const [broken, setBroken] = useState(false);
  const safeSrc = sanitizeImageSrc(src);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const show = Boolean(safeSrc) && !broken;
  const initial = String(label || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={className} style={style} aria-hidden="true">
      {show ? (
        <img
          src={safeSrc}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          style={
            style
              ? { width: "100%", height: "100%", objectFit: "cover", display: "block" }
              : undefined
          }
        />
      ) : (
        <span className={className ? `${className}-ph` : undefined} style={!className ? {
          fontSize: 28,
          fontWeight: "bold",
          color: "var(--text-dim)",
          lineHeight: 1,
        } : undefined}>
          {initial}
        </span>
      )}
    </div>
  );
}
