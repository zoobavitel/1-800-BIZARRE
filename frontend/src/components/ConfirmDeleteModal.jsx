import React, { useEffect, useId, useRef } from "react";

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

const btn = {
  padding: "8px 14px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
  border: "none",
  fontFamily: "monospace",
};

/**
 * In-app confirm before destructive delete.
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   busy?: boolean,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 * }} props
 */
export default function ConfirmDeleteModal({
  open,
  title = "Proceed to delete?",
  message,
  confirmLabel = "Delete",
  busy = false,
  onCancel,
  onConfirm,
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus?.();
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={overlay}
      onClick={() => {
        if (!busy) onCancel?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        style={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id={titleId}
          style={{
            fontWeight: "bold",
            color: "var(--accent, #a78bfa)",
            marginBottom: 8,
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          {title}
        </div>
        <div
          id={messageId}
          style={{
            fontSize: 12,
            color: "var(--text-muted, #9ca3af)",
            marginBottom: 14,
            lineHeight: 1.45,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              ...btn,
              background: "transparent",
              color: "var(--text-muted, #9ca3af)",
              border: "1px solid var(--border, #374151)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              ...btn,
              background: "rgb(69, 10, 10)",
              color: "rgb(254, 202, 202)",
              border: "1px solid rgb(153, 27, 27)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
