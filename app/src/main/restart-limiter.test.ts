import { describe, expect, it } from "vitest";
import { RestartLimiter } from "./restart-limiter";

describe("RestartLimiter", () => {
  it("allows the first start plus three restarts per minute", () => {
    const l = new RestartLimiter();
    expect([0, 1, 2, 3].map((t) => l.tryStart(t * 1000))).toEqual([true, true, true, true]);
    expect(l.tryStart(4000)).toBe(false);
  });

  it("allows starts again once the window has passed", () => {
    const l = new RestartLimiter();
    for (let i = 0; i < 4; i++) l.tryStart(i);
    expect(l.tryStart(30_000)).toBe(false);
    expect(l.tryStart(60_001)).toBe(true);
  });
});
