import { describe, expect, it } from "vitest";
import { BOTTOM_MIN, clampSize, maxBottomHeight, maxSideWidth, SIDE_MIN } from "./panel-layout";

describe("panel sizes", () => {
  it("clamps into the range", () => {
    expect(clampSize(50, SIDE_MIN, 400)).toBe(SIDE_MIN);
    expect(clampSize(500, SIDE_MIN, 400)).toBe(400);
    expect(clampSize(250, SIDE_MIN, 400)).toBe(250);
  });
  it("the minimum wins when there is no room", () => {
    expect(clampSize(300, BOTTOM_MIN, 20)).toBe(BOTTOM_MIN);
  });
  it("leaves room for the editor", () => {
    expect(maxSideWidth(1280, 330)).toBe(650);
    expect(maxSideWidth(1280, 32)).toBe(948);
    expect(maxBottomHeight(740)).toBe(552);
  });
});
