import React, { useEffect, useState } from "react";
import { sanitizeHomeImageSrc } from "../../utils/sanitizeHomeImageSrc";

/**
 * Fixed-size portrait slot; placeholder initial when missing/broken.
 * Pass a CSS class for sizing (e.g. g-card-thumb); parent owns layout styles.
 */
export default function HomeCardThumb({ src, label, className, style }) {
  const [broken, setBroken] = useState(false);
  const safeSrc = sanitizeHomeImageSrc(src);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const show = Boolean(safeSrc) && !broken;
  const initial = String(label || "?").trim().charAt(0).toUpperCase() || "?";
  const rootStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
  };
  return (
    <div className={className} style={rootStyle}>
      {show ? (
        <img
          src={safeSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span
          className={className ? `${className}-ph` : undefined}
          role="img"
          aria-label={String(label || initial).trim() || "?"}
          style={
            className
              ? undefined
              : {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                  fontSize: style?.fontSize ?? 28,
                  fontWeight: style?.fontWeight ?? "bold",
                  color: style?.color ?? "var(--text-dim)",
                  lineHeight: 1,
                  margin: 0,
                  padding: 0,
                }
          }
        >
          {initial}
        </span>
      )}
    </div>
  );
}
