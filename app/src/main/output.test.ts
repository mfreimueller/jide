import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutputBatcher, type OutputChunk } from "./output";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(limit = 100) {
  const emitted: OutputChunk[][] = [];
  const onLimit = vi.fn();
  const b = new OutputBatcher((c) => emitted.push(c), onLimit, limit, 16);
  return { b, emitted, onLimit };
}

describe("OutputBatcher", () => {
  it("batches many small writes into one emit per interval", () => {
    const { b, emitted } = setup();
    for (let i = 0; i < 10; i++) b.push("stdout", Buffer.from("a"));
    expect(emitted).toEqual([]);
    vi.advanceTimersByTime(16);
    expect(emitted).toEqual([[{ stream: "stdout", text: "aaaaaaaaaa" }]]);
  });

  it("keeps the order of stdout and stderr", () => {
    const { b, emitted } = setup();
    b.push("stdout", Buffer.from("a"));
    b.push("stderr", Buffer.from("b"));
    b.push("stdout", Buffer.from("c"));
    vi.advanceTimersByTime(16);
    expect(emitted[0]).toEqual([
      { stream: "stdout", text: "a" },
      { stream: "stderr", text: "b" },
      { stream: "stdout", text: "c" }
    ]);
  });

  it("decodes UTF-8 characters that are split between two reads", () => {
    const { b, emitted } = setup();
    const bytes = Buffer.from("Grüße");
    b.push("stdout", bytes.subarray(0, 3)); // cuts "ü" in half
    b.push("stdout", bytes.subarray(3));
    b.finish();
    expect(emitted.flat().map((c) => c.text).join("")).toBe("Grüße");
  });

  it("counts stdout and stderr together and stops at the limit", () => {
    const { b, emitted, onLimit } = setup(10);
    b.push("stdout", Buffer.from("123456"));
    expect(onLimit).not.toHaveBeenCalled();
    b.push("stderr", Buffer.from("abcdefgh")); // 6 + 8 > 10
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(b.limitReached).toBe(true);
    b.push("stdout", Buffer.from("more")); // dropped
    b.finish();
    expect(emitted.flat().map((c) => c.text).join("")).toBe("123456abcd");
    expect(onLimit).toHaveBeenCalledTimes(1);
  });

  it("finish emits what is pending right away", () => {
    const { b, emitted } = setup();
    b.push("stdout", Buffer.from("x"));
    b.finish();
    expect(emitted).toEqual([[{ stream: "stdout", text: "x" }]]);
    vi.advanceTimersByTime(100);
    expect(emitted).toHaveLength(1);
  });
});
