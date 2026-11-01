import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  autosaveInterval,
  differs,
  examWorkspaceKey,
  localOffsetIso,
  parseTime,
  rankCandidates,
  sameFiles,
  sameName,
  writeAtomic
} from "./exam-store";

describe("rankCandidates", () => {
  it("puts the newest first", () => {
    const r = rankCandidates([
      { source: "handin", at: 300 },
      { source: "local", at: 100 },
      { source: "autosave", at: 200 }
    ]);
    expect(r.map((c) => c.source)).toEqual(["handin", "autosave", "local"]);
  });
  it("prefers local, then autosave, then hand-in on equal times", () => {
    const r = rankCandidates([
      { source: "handin", at: 5 },
      { source: "autosave", at: 5 },
      { source: "local", at: 5 }
    ]);
    expect(r.map((c) => c.source)).toEqual(["local", "autosave", "handin"]);
  });
  it("drops candidates without a valid time and copes with none", () => {
    expect(rankCandidates([{ source: "autosave", at: Number.NaN }])).toEqual([]);
    expect(rankCandidates([])).toEqual([]);
  });
  it("parseTime", () => {
    expect(parseTime("2026-12-03T10:44:12.345+01:00")).toBe(Date.parse("2026-12-03T09:44:12.345Z"));
    expect(parseTime("kein Datum")).toBeNaN();
    expect(parseTime(undefined)).toBeNaN();
  });
});

describe("sameName", () => {
  it("ignores case and surrounding blanks", () => {
    expect(sameName("Max Muster", "  max muster ")).toBe(true);
    expect(sameName("ÄNNA", "änna")).toBe(true);
  });
  it("rejects other names, empty names and non-text", () => {
    expect(sameName("Max Muster", "Erika Muster")).toBe(false);
    expect(sameName("", "")).toBe(false);
    expect(sameName(undefined, "Max")).toBe(false);
    expect(sameName("Max", 5)).toBe(false);
  });
});

describe("localOffsetIso", () => {
  const d = new Date("2026-12-03T09:44:12.345Z");
  it("formats east of UTC (getTimezoneOffset is negative)", () => {
    expect(localOffsetIso(d, -60)).toBe("2026-12-03T10:44:12.345+01:00");
    expect(localOffsetIso(d, -330)).toBe("2026-12-03T15:14:12.345+05:30");
  });
  it("formats UTC and west of UTC", () => {
    expect(localOffsetIso(d, 0)).toBe("2026-12-03T09:44:12.345+00:00");
    expect(localOffsetIso(d, 300)).toBe("2026-12-03T04:44:12.345-05:00");
  });
  it("round-trips to the same instant", () => {
    expect(new Date(localOffsetIso(d, -120)).getTime()).toBe(d.getTime());
  });
});

describe("change detection", () => {
  it("differs only when a baseline file has other content or is missing", () => {
    expect(differs({ A: "x" }, { A: "x" })).toBe(false);
    expect(differs({ A: "x" }, { A: "y" })).toBe(true);
    expect(differs({ A: "x", B: "y" }, { A: "x" })).toBe(true);
    expect(differs({ A: "x" }, { A: "x", B: "z" })).toBe(false);
  });
  it("sameFiles compares both ways", () => {
    expect(sameFiles({ A: "x" }, { A: "x" })).toBe(true);
    expect(sameFiles({ A: "x" }, { A: "x", B: "" })).toBe(false);
    expect(sameFiles({ A: "x" }, { A: "y" })).toBe(false);
  });
});

describe("examWorkspaceKey", () => {
  it("depends on folder, title and the lower-cased trimmed name", () => {
    const k = examWorkspaceKey("P:\\exam", "Test 1", "Max Muster");
    expect(k).toMatch(/^[0-9a-f]{16}$/);
    expect(examWorkspaceKey("P:\\exam", "Test 1", "  max MUSTER ")).toBe(k);
    expect(examWorkspaceKey("P:\\exam", "Test 1", "Erika Muster")).not.toBe(k);
    expect(examWorkspaceKey("P:\\exam", "Test 2", "Max Muster")).not.toBe(k);
    expect(examWorkspaceKey("Q:\\exam", "Test 1", "Max Muster")).not.toBe(k);
  });
});

describe("autosaveInterval", () => {
  it("is 60 s by default and when packaged, whatever the variable says", () => {
    expect(autosaveInterval(undefined, false)).toBe(60_000);
    expect(autosaveInterval("500", true)).toBe(60_000);
  });
  it("accepts a sane override when unpackaged", () => {
    expect(autosaveInterval("500", false)).toBe(500);
    expect(autosaveInterval("abc", false)).toBe(60_000);
    expect(autosaveInterval("1", false)).toBe(60_000);
  });
});

describe("writeAtomic", () => {
  it("writes, overwrites and leaves no temp file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jide-atomic-"));
    try {
      const f = join(dir, "sub", "A.java");
      await writeAtomic(f, "eins");
      await writeAtomic(f, "zwei");
      expect(await readFile(f, "utf8")).toBe("zwei");
      expect(await readdir(join(dir, "sub"))).toEqual(["A.java"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("leaves no temp file when the write fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jide-atomic-"));
    try {
      await mkdir(join(dir, "A.java")); // a folder is in the way of the rename
      await expect(writeAtomic(join(dir, "A.java"), "x")).rejects.toThrow();
      expect(await readdir(dir)).toEqual(["A.java"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
