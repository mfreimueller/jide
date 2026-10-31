import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime, isPast } from "./datetime";

describe("datetime (Vienna time)", () => {
  it("formats a winter date", () => {
    // 2026-11-27 22:59 UTC = 23:59 in Vienna (CET)
    expect(formatDate("2026-11-27T22:59:00Z")).toBe("Fr, 27.11.");
    expect(formatTime("2026-11-27T22:59:00Z")).toBe("23:59");
  });
  it("rolls over to the next day in Vienna time", () => {
    expect(formatDate("2026-11-27T23:30:00Z")).toBe("Sa, 28.11.");
  });
  it("uses summer time", () => {
    expect(formatDateTime("2026-07-02T08:05:00Z")).toBe("Do, 2.7. um 10:05");
  });
  it("formats the hand-in time", () => {
    expect(formatDateTime("2026-11-19T09:44:00Z")).toBe("Do, 19.11. um 10:44");
  });
  it("returns an empty string for garbage", () => {
    expect(formatDate("nope")).toBe("");
  });
  it("isPast", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(isPast("2026-11-19T00:00:00Z", now)).toBe(true);
    expect(isPast("2026-11-21T00:00:00Z", now)).toBe(false);
    expect(isPast(null, now)).toBe(false);
  });
});
