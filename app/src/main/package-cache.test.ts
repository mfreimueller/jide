import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractPackage, needsDownload, PackageCache, restorableFiles } from "./package-cache";

const YAML = (title: string) => `id: summe
title: "${title}"
files:
  - path: Summe.java
    editable: true
  - path: Hilfe.java
    editable: false
mainFile: Summe.java
`;

function pkg(title: string, student = "class Summe {}"): Uint8Array {
  return zipSync({
    "summe/exercise.yaml": strToU8(YAML(title)),
    "summe/aufgabe.md": strToU8(`# ${title}`),
    "summe/files/Summe.java": strToU8(student),
    "summe/files/Hilfe.java": strToU8("class Hilfe {}")
  });
}

describe("needsDownload", () => {
  it("downloads when nothing is cached", () => {
    expect(needsDownload(undefined, "v1", false)).toBe(true);
  });
  it("downloads when the version differs", () => {
    expect(needsDownload("v1", "v2", true)).toBe(true);
  });
  it("keeps the cached package when the version matches", () => {
    expect(needsDownload("v1", "v1", true)).toBe(false);
  });
  it("downloads again when the folder vanished", () => {
    expect(needsDownload("v1", "v1", false)).toBe(true);
  });
});

describe("restorableFiles (new laptop)", () => {
  const files = [
    { path: "Summe.java", editable: true },
    { path: "Hilfe.java", editable: false }
  ];
  const latest = {
    files: [
      { path: "Summe.java", content: "mein code" },
      { path: "Hilfe.java", content: "manipuliert" },
      { path: "Fremd.java", content: "x" }
    ]
  };
  it("restores only editable files of the exercise", () => {
    expect(restorableFiles(false, files, latest)).toEqual([{ path: "Summe.java", content: "mein code" }]);
  });
  it("does nothing without a hand-in", () => {
    expect(restorableFiles(false, files, null)).toBeUndefined();
  });
  it("never touches an existing workspace", () => {
    expect(restorableFiles(true, files, latest)).toBeUndefined();
  });
  it("does nothing when the hand-in has no usable file", () => {
    expect(restorableFiles(false, files, { files: [{ path: "Hilfe.java", content: "x" }] })).toBeUndefined();
  });
});

describe("extractPackage", () => {
  it("strips the <id>/ folder", () => {
    const m = extractPackage(pkg("A"), "summe");
    expect([...m.keys()].sort()).toEqual(["aufgabe.md", "exercise.yaml", "files/Hilfe.java", "files/Summe.java"]);
  });
  it("rejects path traversal", () => {
    const evil = zipSync({ "summe/exercise.yaml": strToU8("x"), "summe/../evil.txt": strToU8("x") });
    expect(() => extractPackage(evil, "summe")).toThrow();
  });
  it("rejects a package for another folder", () => {
    expect(() => extractPackage(pkg("A"), "andere")).toThrow();
  });
});

describe("PackageCache", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "jide-cache-"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("installs a package and remembers its version", async () => {
    const cache = new PackageCache(dir);
    expect(await cache.hasFolder("summe")).toBe(false);
    await cache.install("summe", "v1", pkg("Summe"));
    expect(await cache.hasFolder("summe")).toBe(true);
    expect(await cache.version("summe")).toBe("v1");
    expect(await readFile(path.join(cache.exerciseDir("summe"), "files", "Summe.java"), "utf8")).toBe("class Summe {}");
  });

  it("keeps only the latest version", async () => {
    const cache = new PackageCache(dir);
    await cache.install("summe", "v1", pkg("Alt"));
    await cache.install("summe", "v2", pkg("Neu"));
    expect(await cache.version("summe")).toBe("v2");
    expect(await readFile(path.join(cache.exerciseDir("summe"), "aufgabe.md"), "utf8")).toBe("# Neu");
  });

  it("keeps the old version when the new package is broken", async () => {
    const cache = new PackageCache(dir);
    await cache.install("summe", "v1", pkg("Alt"));
    const broken = zipSync({ "summe/exercise.yaml": strToU8(YAML("Kaputt")) }); // files/ missing
    await expect(cache.install("summe", "v2", broken)).rejects.toThrow();
    expect(await cache.version("summe")).toBe("v1");
    expect(await readFile(path.join(cache.exerciseDir("summe"), "aufgabe.md"), "utf8")).toBe("# Alt");
  });

  it("stores the list", async () => {
    const cache = new PackageCache(dir);
    expect(await cache.readList()).toBeUndefined();
    await cache.writeList([{ id: "summe", title: "Summe", version: "v1", deadline: null }]);
    expect((await cache.readList())?.[0]?.id).toBe("summe");
  });
});
