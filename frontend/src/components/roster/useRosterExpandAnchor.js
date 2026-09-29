import { useLayoutEffect, useRef, useState } from "react";
import { measureRosterExpandTop } from "./rosterShared";

/**
 * Anchor `.session-roster-expand-slot` under the expanded token card.
 * @param {unknown} expandedKey — id / truthy when a panel is open
 */
export default function useRosterExpandAnchor(expandedKey) {
  const tokensRef = useRef(null);
  const [expandTop, setExpandTop] = useState(0);

  useLayoutEffect(() => {
    const root = tokensRef.current;
    const open =
      expandedKey != null && expandedKey !== false && expandedKey !== "";
    if (!root || !open) {
      setExpandTop(0);
      return undefined;
    }
    const update = () => {
      const card = root.querySelector(
        ".p-card.is-expanded, .npc-card.is-expanded, .f-card.is-expanded",
      );
      setExpandTop(measureRosterExpandTop(root, card));
    };
    update();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(root);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [expandedKey]);

  const tokensStyle =
    expandTop > 0
      ? { "--roster-expand-top": `${Math.round(expandTop)}px` }
      : undefined;

  return { tokensRef, tokensStyle };
}
