import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readTheme, writeTheme } from "./settings";

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "jide-settings-"));
  file = join(dir, "settings.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("readTheme", () => {
  it("a missing file means system", () => {
    expect(readTheme(file)).toBe("system");
  });

  it.each(["not json", "[]", "null", '{"theme":"blue"}', '{"theme":1}', "{}"])("invalid content %s means system", (text) => {
    writeFileSync(file, text);
    expect(readTheme(file)).toBe("system");
  });

  it.each(["light", "dark", "system"] as const)("reads %s", (theme) => {
    writeFileSync(file, JSON.stringify({ theme }));
    expect(readTheme(file)).toBe(theme);
  });
});

describe("writeTheme", () => {
  it("round-trips and creates the folder", () => {
    const nested = join(dir, "a", "b", "settings.json");
    writeTheme(nested, "dark");
    expect(readTheme(nested)).toBe("dark");
    writeTheme(nested, "system");
    expect(readTheme(nested)).toBe("system");
  });

  it("keeps other keys of the file", () => {
    writeFileSync(file, JSON.stringify({ other: 1 }));
    writeTheme(file, "light");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ other: 1, theme: "light" });
  });

  it("replaces an invalid file", () => {
    writeFileSync(file, "garbage");
    writeTheme(file, "dark");
    expect(readTheme(file)).toBe("dark");
  });

  it("does not throw when the folder is not writable", () => {
    writeFileSync(join(dir, "blocker"), "x"); // a file where a folder is needed
    expect(() => writeTheme(join(dir, "blocker", "settings.json"), "dark")).not.toThrow();
  });
});
