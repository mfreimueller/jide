import { describe, expect, it } from "vitest";
import { normalisePracticeHost } from "./practice-hosts.js";

describe("normalisePracticeHost", () => {
  it("trims and lower-cases", () => {
    expect(normalisePracticeHost("  Die-Spengergasse.GitHub.io ")).toBe("die-spengergasse.github.io");
  });
  it("accepts a plain two-label name", () => {
    expect(normalisePracticeHost("example.com")).toBe("example.com");
  });
  it.each([
    "", "   ", "localhost", "example", "a..b", ".example.com", "example.com.", "-a.example.com", "a-.example.com",
    "exa mple.com", "example.com:8080", "https://example.com", "example.com/path", "user@example.com", "ex_ample.com",
    "192.168.0.1", "1.2.3.4", "[::1]", "example.123", "bücher.example.com",
  ])("rejects %j", (raw) => {
    expect(normalisePracticeHost(raw)).toBeNull();
  });
  it("enforces label and total length", () => {
    expect(normalisePracticeHost(`${"a".repeat(63)}.com`)).not.toBeNull();
    expect(normalisePracticeHost(`${"a".repeat(64)}.com`)).toBeNull();
    const long = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com`;
    expect(long.length).toBe(253);
    expect(normalisePracticeHost(long)).toBe(long);
    expect(normalisePracticeHost(`x${long}`)).toBeNull();
  });
});
