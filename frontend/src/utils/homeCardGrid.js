/** Match `.home-card-grid` in Home.css */
export const HOME_CARD_GRID_MIN_WIDTH = 160;
export const HOME_CARD_GRID_GAP = 10;

/** Collapsed preview before ResizeObserver runs (narrow/mobile-safe default). */
export const HOME_CARD_GRID_FALLBACK_COLUMNS = 2;

/**
 * How many token cards fit on one row for `repeat(auto-fill, minmax(...))`.
 *
 * @param {number} containerWidth
 * @param {{ minWidth?: number, gap?: number }} [opts]
 * @returns {number}
 */
export function homeCardGridColumnCount(
  containerWidth,
  {
    minWidth = HOME_CARD_GRID_MIN_WIDTH,
    gap = HOME_CARD_GRID_GAP,
  } = {},
) {
  const width = Number(containerWidth);
  if (!Number.isFinite(width) || width <= 0) {
    return HOME_CARD_GRID_FALLBACK_COLUMNS;
  }
  return Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
}
