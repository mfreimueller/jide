import { describe, expect, it } from "vitest";
import { fitScale, svgDataUrl, svgSize, zoomIn, zoomOut } from "./svg-size";

describe("svgSize", () => {
  it("reads width and height", () => {
    expect(svgSize('<svg xmlns="x" width="320px" height="200.5">')).toEqual({ width: 320, height: 200.5 });
  });
  it("falls back to the viewBox", () => {
    expect(svgSize('<?xml?><svg viewBox="0 0 120 80">')).toEqual({ width: 120, height: 80 });
    expect(svgSize('<svg width="50%" viewBox="0,0,120,80">')).toEqual({ width: 120, height: 80 });
  });
  it("gives up without size info", () => {
    expect(svgSize("<svg>")).toBeUndefined();
  });
});

describe("zoom", () => {
  it("steps through the list", () => {
    expect(zoomIn(0.62)).toBe(0.67);
    expect(zoomIn(1)).toBe(1.25);
    expect(zoomIn(4)).toBe(4);
    expect(zoomOut(0.62)).toBe(0.5);
    expect(zoomOut(1)).toBe(0.9);
    expect(zoomOut(0.25)).toBe(0.25);
  });
  it("fits without enlarging", () => {
    expect(fitScale({ width: 1000, height: 500 }, { width: 500, height: 500 })).toBe(0.5);
    expect(fitScale({ width: 100, height: 100 }, { width: 500, height: 500 })).toBe(1);
  });
  it("encodes the svg as a data url", () => {
    expect(svgDataUrl("<svg a='b'/>")).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D'b'%2F%3E");
  });
});
