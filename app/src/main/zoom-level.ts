/** Same step as Ansicht > Vergrößern / Verkleinern (Electron roles zoomIn / zoomOut). */
export const ZOOM_STEP = 0.5;
/** Window zoom level 0 = 100 %, each whole level is x1.2; so 76 % ... 144 %. */
export const ZOOM_LEVEL_MIN = -1.5;
export const ZOOM_LEVEL_MAX = 2;

/** The level after `steps` (+ bigger, - smaller) menu-sized steps, kept within the allowed range. */
export function nextZoomLevel(level: number, steps: number): number {
  const next = level + steps * ZOOM_STEP;
  return Math.min(ZOOM_LEVEL_MAX, Math.max(ZOOM_LEVEL_MIN, next));
}
