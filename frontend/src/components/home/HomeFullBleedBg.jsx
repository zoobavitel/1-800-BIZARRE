import React, { useEffect, useState } from "react";
import { sanitizeHomeImageSrc } from "../../utils/sanitizeHomeImageSrc";

/**
 * Resolve a media URL into a safe src and track load failures.
 * @param {string|null|undefined} src
 * @returns {{ hasImage: boolean, safeSrc: string, onError: () => void }}
 */
export function useHomeCardImage(src) {
  const [imageBroken, setImageBroken] = useState(false);
  const safeSrc = sanitizeHomeImageSrc(src);

  useEffect(() => {
    setImageBroken(false);
  }, [src]);

  return {
    hasImage: Boolean(safeSrc) && !imageBroken,
    safeSrc,
    onError: () => setImageBroken(true),
  };
}

/**
 * Full-bleed decorative background + gradient scrim for home list cards.
 * Parent must be position:relative; overflow:hidden; isolation:isolate.
 */
export default function HomeFullBleedBg({
  src,
  onError,
  className = "home-card-bg",
  scrimClassName = "home-card-scrim",
}) {
  if (!src) return null;
  return (
    <>
      <div className={className} aria-hidden="true">
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onError}
        />
      </div>
      <div className={scrimClassName} aria-hidden="true" />
    </>
  );
}
