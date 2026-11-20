import { describe, expect, it } from "vitest";
import { isRunShortcutKey, runShortcut, type KeyLike, type RunShortcutState } from "./run-shortcuts";

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: k, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...mods });
const idle: RunShortcutState = { runnable: true, runState: "idle", testsState: "idle" };

describe("runShortcut", () => {
  it("F5 runs, Shift+F5 tests", () => {
    expect(runShortcut(key("F5"), idle)).toBe("run");
    expect(runShortcut(key("F5", { shiftKey: true }), idle)).toBe("test");
  });
  it("does nothing while a program runs or starts, or tests run (like the disabled buttons)", () => {
    for (const s of [
      { ...idle, runState: "running" as const },
      { ...idle, runState: "starting" as const },
      { ...idle, testsState: "running" as const }
    ]) {
      expect(runShortcut(key("F5"), s)).toBeUndefined();
      expect(runShortcut(key("F5", { shiftKey: true }), s)).toBeUndefined();
    }
  });
  it("Shift+F5 does nothing without tests; F5 still runs", () => {
    const s = { ...idle, testsState: undefined };
    expect(runShortcut(key("F5", { shiftKey: true }), s)).toBeUndefined();
    expect(runShortcut(key("F5"), s)).toBe("run");
  });
  it("does nothing in the graded view", () => {
    expect(runShortcut(key("F5"), { ...idle, runnable: false })).toBeUndefined();
  });
  it("only plain F5 / Shift+F5: other keys and Ctrl/Alt/Cmd combinations are not ours", () => {
    expect(runShortcut(key("F6"), idle)).toBeUndefined();
    expect(isRunShortcutKey(key("F5", { ctrlKey: true }))).toBe(false);
    expect(isRunShortcutKey(key("F5", { metaKey: true }))).toBe(false);
    expect(isRunShortcutKey(key("F5", { altKey: true }))).toBe(false);
    expect(isRunShortcutKey(key("F5", { shiftKey: true }))).toBe(true);
  });
});
