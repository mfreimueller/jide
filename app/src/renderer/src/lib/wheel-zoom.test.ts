import { describe, expect, it } from "vitest";
import { createWheelZoom } from "./wheel-zoom";

const px = (deltaY: number) => ({ deltaY, deltaMode: 0 });

describe("createWheelZoom", () => {
  it("one mouse notch is one step, up = bigger", () => {
    const z = createWheelZoom();
    expect(z(px(-100), 0)).toBe(1);
    expect(z(px(100), 1000)).toBe(-1);
  });
  it("line and page deltas are normalised", () => {
    const z = createWheelZoom();
    expect(z({ deltaY: -3, deltaMode: 1 }, 0)).toBe(1);
    expect(z({ deltaY: 1, deltaMode: 2 }, 1000)).toBe(-4);
  });
  it("small trackpad deltas add up to a step", () => {
    const z = createWheelZoom();
    let total = 0;
    for (let i = 0; i < 9; i++) total += z(px(-10), i * 16);
    expect(total).toBe(0);
    total += z(px(-10), 9 * 16);
    expect(total).toBe(1);
    // the remainder carries on
    for (let i = 0; i < 10; i++) total += z(px(-10), 200 + i * 16);
    expect(total).toBe(2);
  });
  it("a fast spin gives several steps at once", () => {
    expect(createWheelZoom()(px(-250), 0)).toBe(2);
  });
  it("flipping the direction drops the sum", () => {
    const z = createWheelZoom();
    expect(z(px(-60), 0)).toBe(0);
    expect(z(px(60), 16)).toBe(0); // the -60 is gone, not netted against the +60
    expect(z(px(60), 32)).toBe(-1);
  });
  it("a pause drops the sum", () => {
    const z = createWheelZoom();
    expect(z(px(-60), 0)).toBe(0);
    expect(z(px(-60), 1000)).toBe(0);
  });
  it("ignores zero deltas", () => {
    expect(createWheelZoom()(px(0), 0)).toBe(0);
  });
});
