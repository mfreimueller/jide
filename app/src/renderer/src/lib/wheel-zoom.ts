/**
 * Ctrl + wheel zoom steps. A mouse notch is about 100 px (or 3 lines), a trackpad / pinch sends many
 * small deltas that add up. One step per STEP_PX; the sum starts over when the direction flips or the
 * wheel rested for a moment.
 */
export const STEP_PX = 100;
const LINE_PX = 100 / 3; // deltaMode LINE: a notch is 3 lines
const PAGE_PX = 400;
const IDLE_MS = 300;

export interface WheelInput {
  deltaY: number;
  /** WheelEvent.deltaMode: 0 pixel, 1 line, 2 page. */
  deltaMode: number;
}

/** Returns a function that takes wheel events and answers the zoom steps to make: + bigger, - smaller. */
export function createWheelZoom(): (e: WheelInput, now: number) => number {
  let sum = 0;
  let last = -Infinity;
  return (e, now) => {
    const px = e.deltaY * (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? PAGE_PX : 1);
    if (px === 0) return 0;
    if (now - last > IDLE_MS || Math.sign(px) !== Math.sign(sum)) sum = 0;
    last = now;
    sum += px;
    const steps = Math.trunc(Math.abs(sum) / STEP_PX);
    if (steps === 0) return 0;
    sum -= Math.sign(sum) * steps * STEP_PX;
    // wheel up (negative deltaY) = bigger
    return -Math.sign(px) * steps;
  };
}
