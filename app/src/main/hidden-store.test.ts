import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { accountKey, HiddenStore } from "./hidden-store";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "jide-hidden-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("HiddenStore", () => {
  it("starts empty and remembers choices across instances", () => {
    const file = path.join(dir, "hidden.json");
    const s = new HiddenStore(file, () => "a");
    expect(s.get()).toEqual({});
    s.set("x", "hidden");
    s.set("y", "shown");
    expect(new HiddenStore(file, () => "a").get()).toEqual({ x: "hidden", y: "shown" });
  });

  it("keeps accounts apart", () => {
    const file = path.join(dir, "hidden.json");
    let acc = "a";
    const s = new HiddenStore(file, () => acc);
    s.set("x", "hidden");
    acc = "b";
    expect(s.get()).toEqual({});
    s.set("x", "shown");
    acc = "a";
    expect(s.get()).toEqual({ x: "hidden" });
  });

  it("null clears a choice; bad input is refused", () => {
    const s = new HiddenStore(path.join(dir, "hidden.json"), () => "a");
    s.set("x", "hidden");
    expect(s.set("x", null)).toEqual({});
    expect(s.set("", "hidden")).toBeUndefined();
    expect(s.set("x", "bogus")).toBeUndefined();
    expect(s.set(5, "hidden")).toBeUndefined();
  });

  it("survives a broken file and leaves no temp file", () => {
    const file = path.join(dir, "hidden.json");
    writeFileSync(file, "{nope", "utf8");
    const s = new HiddenStore(file, () => "a");
    expect(s.get()).toEqual({});
    s.set("x", "hidden");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ a: { x: "hidden" } });
  });
});

describe("accountKey", () => {
  it("differs per code and per server, never contains the code", () => {
    const k = accountKey("http://s", "ABC-123");
    expect(k).not.toContain("ABC");
    expect(k).not.toBe(accountKey("http://s", "ABC-124"));
    expect(k).not.toBe(accountKey("http://t", "ABC-123"));
    expect(accountKey("http://s", undefined)).toBe("local");
  });
});
