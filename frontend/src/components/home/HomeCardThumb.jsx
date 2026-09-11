import React, { useEffect, useState } from "react";

/**
 * Fixed-size portrait slot; placeholder initial when missing/broken.
 * Pass a CSS class for sizing (e.g. g-card-thumb); parent owns layout styles.
 */
export default function HomeCardThumb({ src, label, className, style }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const show = Boolean(src) && !broken;
  const initial = String(label || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={className} style={style} aria-hidden="true">
      {show ? (
        <img
          src={src}
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
