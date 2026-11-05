import { describe, expect, it } from "vitest";
import { nextZoomLevel, ZOOM_LEVEL_MAX, ZOOM_LEVEL_MIN } from "./zoom-level";

describe("nextZoomLevel", () => {
  it("steps by 0.5 like the menu", () => {
    expect(nextZoomLevel(0, 1)).toBe(0.5);
    expect(nextZoomLevel(0, -1)).toBe(-0.5);
    expect(nextZoomLevel(1, -2)).toBe(0);
  });
  it("the range is 76 % to 120 %", () => {
    expect(ZOOM_LEVEL_MAX).toBe(1);
    expect(ZOOM_LEVEL_MIN).toBe(-1.5);
    expect(nextZoomLevel(0.5, 2)).toBe(1);
  });
  it("stays within the range", () => {
    expect(nextZoomLevel(ZOOM_LEVEL_MAX, 1)).toBe(ZOOM_LEVEL_MAX);
    expect(nextZoomLevel(ZOOM_LEVEL_MIN, -1)).toBe(ZOOM_LEVEL_MIN);
    expect(nextZoomLevel(9, -1)).toBe(ZOOM_LEVEL_MAX); // e.g. after menu zoom beyond the range
  });
});
