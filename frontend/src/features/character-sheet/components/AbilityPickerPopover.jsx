import React, { useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/** Fixed popover style clamped to the visible viewport (incl. embedded preview). */
export function getVisibleViewportBox() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const docEl =
    typeof document !== "undefined" ? document.documentElement : null;
  const width = Math.min(
    window.innerWidth || Infinity,
    docEl?.clientWidth || Infinity,
    vv?.width || Infinity,
  );
  const height = Math.min(
    window.innerHeight || Infinity,
    docEl?.clientHeight || Infinity,
    vv?.height || Infinity,
  );
  const offsetLeft = vv?.offsetLeft || 0;
  const offsetTop = vv?.offsetTop || 0;
  return {
    width: Number.isFinite(width) ? width : window.innerWidth,
    height: Number.isFinite(height) ? height : window.innerHeight,
    offsetLeft,
    offsetTop,
  };
}

export function computeAbilityPickerFixedStyle(anchorEl) {
  const pad = 8;
  const vp = getVisibleViewportBox();
  const maxRight = vp.offsetLeft + vp.width - pad;
  const maxBottom = vp.offsetTop + vp.height - pad;
  const minLeft = vp.offsetLeft + pad;
  const minTop = vp.offsetTop + pad;
  const width = Math.min(320, Math.max(200, vp.width - pad * 2));
  const base = {
    position: "fixed",
    zIndex: 400,
    width,
    maxWidth: width,
    padding: "8px",
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "4px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
    boxSizing: "border-box",
    // Outer does not scroll — inner list owns overflow (avoids double scrollbar).
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  };
  if (!anchorEl || typeof window === "undefined") {
    return {
      ...base,
      top: minTop,
      left: minLeft,
      maxHeight: Math.max(160, vp.height - pad * 2),
    };
  }
  const r = anchorEl.getBoundingClientRect();
  const spaceBelow = maxBottom - (r.bottom + 4);
  const spaceAbove = r.top - 4 - minTop;
  const openDown = spaceBelow >= 180 || spaceBelow >= spaceAbove;
  let maxHeight = Math.max(
    140,
    Math.min(400, openDown ? spaceBelow : spaceAbove),
  );
  // Prefer align-left with trigger; if that overflows right, shift left.
  let left = r.left;
  if (left + width > maxRight) left = maxRight - width;
  if (left < minLeft) left = minLeft;
  // If still wider than viewport, shrink already handled via width = vp - pads.
  let top = openDown ? r.bottom + 4 : r.top - 4 - maxHeight;
  if (top < minTop) top = minTop;
  if (top + maxHeight > maxBottom) {
    maxHeight = Math.max(140, maxBottom - top);
  }
  return { ...base, top, left, maxHeight };
}

export default function AbilityPickerPopover({ open, anchorRef, children }) {
  const [style, setStyle] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return undefined;
    }
    const update = () => {
      const wrap = anchorRef?.current;
      const anchor = wrap?.querySelector?.("button") || wrap || null;
      setStyle(computeAbilityPickerFixedStyle(anchor));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, anchorRef]);
  if (!open || !style || typeof document === "undefined") return null;
  return createPortal(
    <div data-ability-picker-popover="" style={style}>
      {children}
    </div>,
    document.body,
  );
}
