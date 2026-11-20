import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExercise, openWorkspace, type Exercise } from "@jide/shared";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompositeSource, scratchEntry } from "./composite-source";
import { classNameProblem, isScratchId, ScratchStore } from "./scratch";
import { COPY_UNAVAILABLE_MESSAGE, SCRATCH_NOT_ALLOWED_MESSAGE, scratchHandlers } from "./scratch-handlers";
import type { ExerciseSource } from "./source";

let tmp: string;
let store: ScratchStore;
let ws: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "jide-scratch-"));
  store = new ScratchStore(join(tmp, "scratch"));
  ws = join(tmp, "workspaces");
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false
  );
}

async function make(title = "Mein Programm"): Promise<string> {
  const r = await store.create(title);
  if (!r.ok) throw new Error(r.message);
  return r.id;
}

describe("create", () => {
  it("writes a package the shared parser loads", async () => {
    const id = await make("  Erste Übung ");
    expect(isScratchId(id)).toBe(true);
    const ex = await loadExercise(join(tmp, "scratch", id));
    expect(ex.id).toBe(id);
    expect(ex.title).toBe("Erste Übung");
    expect(ex.mainFile).toBe("Main.java");
    expect(ex.files).toEqual([{ path: "Main.java", editable: true }]);
    expect(ex.originals["Main.java"]).toBe("void main() {\n\n}\n");
    expect(ex.assignment).toBe("");
    expect(ex.tests).toBeUndefined();
  });

  it("gives unique ids that match the server id rule", async () => {
    const a = await make();
    const b = await make();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9-]+$/);
  });

  it("refuses an empty or too long name", async () => {
    expect(await store.create("   ")).toEqual({ ok: false, message: "Bitte gib einen Namen ein." });
    expect((await store.create("x".repeat(81))).ok).toBe(false);
    expect((await store.list()).exercises).toEqual([]);
  });

  it("lists created items and finds them by id only", async () => {
    const id = await make();
    expect((await store.list()).exercises.map((e) => e.id)).toEqual([id]);
    expect((await store.find(id))?.id).toBe(id);
    expect(await store.find("scratch-../x")).toBeUndefined();
    expect(await store.find("summe")).toBeUndefined();
  });

  it("opens in a workspace like any exercise and never overwrites", async () => {
    const id = await make();
    const ex = (await store.find(id))!;
    await openWorkspace(ex, ws);
    await writeFile(join(ws, id, "Main.java"), "mein code");
    const again = await openWorkspace(ex, ws);
    expect(again.files[0]!.content).toBe("mein code");
  });
});

describe("rename", () => {
  it("changes only the title", async () => {
    const id = await make("Alt");
    expect(await store.rename(id, " Neu ")).toEqual({ ok: true });
    const ex = (await store.find(id))!;
    expect(ex.title).toBe("Neu");
    expect(ex.id).toBe(id);
  });

  it("refuses empty names and unknown ids", async () => {
    const id = await make();
    expect((await store.rename(id, "")).ok).toBe(false);
    expect(await store.rename("scratch-000000000000", "X")).toEqual({ ok: false, message: "Dieses Programm gibt es nicht." });
  });

  it("handles a title with YAML special characters", async () => {
    const id = await make();
    await store.rename(id, 'a: "b" # c\n- d');
    expect((await store.find(id))?.title).toBe('a: "b" # c\n- d');
  });
});

describe("delete", () => {
  it("removes package and workspace", async () => {
    const id = await make();
    await openWorkspace((await store.find(id))!, ws);
    expect(await store.delete(id, ws)).toEqual({ ok: true });
    expect(await exists(join(tmp, "scratch", id))).toBe(false);
    expect(await exists(join(ws, id))).toBe(false);
    expect(await store.find(id)).toBeUndefined();
  });

  it("refuses unknown ids and never touches other folders", async () => {
    await mkdir(join(ws, "summe"), { recursive: true });
    expect((await store.delete("summe", ws)).ok).toBe(false);
    expect((await store.delete("../x", ws)).ok).toBe(false);
    expect(await exists(join(ws, "summe"))).toBe(true);
  });
});

describe("addClass", () => {
  it("creates the file and lists it as editable", async () => {
    const id = await make();
    expect(await store.addClass(id, "Person")).toEqual({ ok: true, path: "Person.java" });
    const ex = (await store.find(id))!;
    expect(ex.files).toEqual([
      { path: "Main.java", editable: true },
      { path: "Person.java", editable: true }
    ]);
    expect(ex.originals["Person.java"]).toBe("class Person {\n}\n");
    expect(ex.mainFile).toBe("Main.java");
    const opened = await openWorkspace(ex, ws);
    expect(opened.files.map((f) => f.path)).toEqual(["Main.java", "Person.java"]);
  });

  it("adds a class to an item whose workspace already exists", async () => {
    const id = await make();
    await openWorkspace((await store.find(id))!, ws);
    await store.addClass(id, "Hund");
    expect((await openWorkspace((await store.find(id))!, ws)).files.map((f) => f.path)).toContain("Hund.java");
  });

  it("refuses invalid, reserved and duplicate names", async () => {
    const id = await make();
    for (const bad of ["", " ", "1Abc", "Ab-c", "Ab c", "../X", "A.b", "class", "var", "Ärger", 5, undefined]) {
      expect((await store.addClass(id, bad)).ok, String(bad)).toBe(false);
    }
    expect((await store.addClass(id, "Main")).ok).toBe(false);
    expect((await store.addClass(id, "main")).ok).toBe(false);
    await store.addClass(id, "Foo");
    expect(await store.addClass(id, "foo")).toEqual({ ok: false, message: "Die Klasse „foo“ gibt es schon." });
    expect((await store.find(id))!.files).toHaveLength(2);
  });

  it("accepts ordinary class names", () => {
    for (const ok of ["A", "Hund", "Konto2", "_x", "My_Class"]) expect(classNameProblem(ok)).toBeUndefined();
  });
});

describe("deleteClass", () => {
  it("removes an added class from package, yaml and workspace", async () => {
    const id = await make();
    await store.addClass(id, "Hund");
    await openWorkspace((await store.find(id))!, ws);
    expect(await store.deleteClass(id, "Hund.java", ws)).toEqual({ ok: true });
    const ex = (await store.find(id))!;
    expect(ex.files.map((f) => f.path)).toEqual(["Main.java"]);
    expect(await exists(join(tmp, "scratch", id, "files", "Hund.java"))).toBe(false);
    expect(await exists(join(ws, id, "Hund.java"))).toBe(false);
  });

  it("never deletes Main.java", async () => {
    const id = await make();
    const r = await store.deleteClass(id, "Main.java", ws);
    expect(r.ok).toBe(false);
    expect((await store.find(id))!.files.map((f) => f.path)).toEqual(["Main.java"]);
    expect(await exists(join(tmp, "scratch", id, "files", "Main.java"))).toBe(true);
  });

  it("refuses files that are not part of the item", async () => {
    const id = await make();
    expect((await store.deleteClass(id, "../../x.java", ws)).ok).toBe(false);
    expect((await store.deleteClass(id, "Nope.java", ws)).ok).toBe(false);
    expect((await store.deleteClass(id, 3, ws)).ok).toBe(false);
  });
});

describe("pickAssignment", () => {
  it("copies the md file into the item and replaces an earlier one", async () => {
    const id = await make();
    const src = join(tmp, "angabe.md");
    await writeFile(src, "# Aufgabe\nSchreibe etwas.");
    expect(await store.pickAssignment(id, src)).toEqual({ ok: true });
    expect((await store.find(id))!.assignment).toBe("# Aufgabe\nSchreibe etwas.");
    // copied, not referenced: the source may change or disappear
    await rm(src);
    expect((await store.find(id))!.assignment).toBe("# Aufgabe\nSchreibe etwas.");
    const src2 = join(tmp, "zwei.MD");
    await writeFile(src2, "neu");
    expect(await store.pickAssignment(id, src2)).toEqual({ ok: true });
    expect((await store.find(id))!.assignment).toBe("neu");
  });

  it("refuses non-md, missing files and unknown items", async () => {
    const id = await make();
    const txt = join(tmp, "a.txt");
    await writeFile(txt, "x");
    expect((await store.pickAssignment(id, txt)).ok).toBe(false);
    expect((await store.pickAssignment(id, join(tmp, "fehlt.md"))).ok).toBe(false);
    expect((await store.pickAssignment(id, 1)).ok).toBe(false);
    expect((await store.pickAssignment("scratch-000000000000", txt)).ok).toBe(false);
    expect((await store.find(id))!.assignment).toBe("");
  });
});

describe("CompositeSource", () => {
  function main(over: Partial<ExerciseSource> = {}): ExerciseSource & { handIn: ReturnType<typeof vi.fn> } {
    const serverEx = { id: "summe", title: "Summe" } as Exercise;
    return {
      kind: "online",
      list: vi.fn(async () => ({
        exercises: [
          { id: "summe", title: "Summe", deadline: "2026-12-01T00:00:00Z", groupId: 3 },
          { id: "scratch-aaaaaaaaaaaa", title: "Fremd", deadline: null, groupId: null }
        ],
        groups: [],
        errors: [],
        offline: false
      })),
      find: vi.fn(async (id: unknown) => (id === "summe" ? serverEx : undefined)),
      deadlineOf: vi.fn(async () => "2026-12-01T00:00:00Z"),
      prepareWorkspace: vi.fn(async () => ({ ok: true as const })),
      handIn: vi.fn(async () => ({ ok: true as const, submittedAt: "x", late: false })),
      ...over
    } as never;
  }

  it("lists server exercises plus marked Scratch entries", async () => {
    const id = await make("Mein Ding");
    const list = await new CompositeSource(main(), store).list();
    expect(list.exercises.map((e) => [e.id, e.scratch ?? false])).toEqual([
      ["summe", false],
      [id, true]
    ]);
    expect(list.exercises[1]).toMatchObject({ title: "Mein Ding", deadline: null, groupId: null });
  });

  it("routes find, deadline and prepare by id; the server never sees Scratch ids", async () => {
    const id = await make();
    const m = main();
    const c = new CompositeSource(m, store);
    expect((await c.find(id))?.id).toBe(id);
    expect((await c.find("summe"))?.id).toBe("summe");
    expect(m.find).toHaveBeenCalledTimes(1);
    expect(await c.deadlineOf(id)).toBeNull();
    expect(await c.deadlineOf("summe")).toBe("2026-12-01T00:00:00Z");
    const scratchEx = (await c.find(id))!;
    await c.prepareWorkspace(scratchEx, ws, false);
    expect(m.prepareWorkspace).not.toHaveBeenCalled();
    await c.prepareWorkspace({ id: "summe" } as Exercise, ws, false);
    expect(m.prepareWorkspace).toHaveBeenCalledTimes(1);
    expect(await c.find("scratch-bbbbbbbbbbbb")).toBeUndefined();
  });

  it("has no hand-in for Scratch, the main source keeps its own", async () => {
    const id = await make();
    const m = main();
    const c = new CompositeSource(m, store);
    const r = await c.handIn!((await c.find(id))!, [], null);
    expect(r.ok).toBe(false);
    expect(m.handIn).not.toHaveBeenCalled();
    expect((await c.handIn!({ id: "summe" } as Exercise, [], null)).ok).toBe(true);
    expect(m.handIn).toHaveBeenCalledTimes(1);
  });

  it("offers no hand-in at all when the main source has none (local mode)", () => {
    const c = new CompositeSource(main({ handIn: undefined }), store);
    expect(c.handIn).toBeUndefined();
    expect(c.kind).toBe("online");
  });

  it("works while the main source lists nothing (online before login)", async () => {
    const id = await make();
    const empty = main({ list: async () => ({ exercises: [], groups: [], errors: [], offline: false }) });
    expect((await new CompositeSource(empty, store).list()).exercises.map((e) => e.id)).toEqual([id]);
  });
});

describe("exam mode", () => {
  it("refuses every Scratch call without a store", async () => {
    const h = scratchHandlers(() => undefined, () => ws);
    const refused = { ok: false, message: SCRATCH_NOT_ALLOWED_MESSAGE };
    expect(await h.create("X")).toEqual(refused);
    expect(await h.rename("a", "b")).toEqual(refused);
    expect(await h.delete("a")).toEqual(refused);
    expect(await h.addClass("a", "B")).toEqual(refused);
    expect(await h.deleteClass("a", "B.java")).toEqual(refused);
    expect(await h.pickAssignment("a", "/x.md")).toEqual(refused);
    const pick = vi.fn(async () => "/x.md");
    expect(await h.chooseAssignment("a", pick)).toEqual(refused);
    expect(pick).not.toHaveBeenCalled();
    expect(await exists(join(tmp, "scratch"))).toBe(false);
  });

  it("passes calls to the store otherwise, with the workspace root", async () => {
    const h = scratchHandlers(() => store, () => ws);
    const r = await h.create("Via IPC");
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    await openWorkspace((await store.find(id))!, ws);
    expect(await h.delete(id)).toEqual({ ok: true });
    expect(await exists(join(ws, id))).toBe(false);
  });
});

describe("list entries and the file dialog", () => {
  it("counts the .java files of an item", async () => {
    const id = await make();
    expect(scratchEntry((await store.find(id))!)).toMatchObject({ id, scratch: true, classCount: 1, deadline: null, groupId: null });
    await store.addClass(id, "Rechner");
    expect(scratchEntry((await store.find(id))!).classCount).toBe(2);
  });

  it("chooseAssignment copies the chosen file; a canceled dialog changes nothing", async () => {
    const h = scratchHandlers(() => store, () => ws);
    const id = await make();
    expect(await h.chooseAssignment(id, async () => undefined)).toEqual({ ok: true, canceled: true });
    expect((await store.find(id))!.assignment).toBe("");
    const md = join(tmp, "angabe.md");
    await writeFile(md, "# Rechner\n", "utf8");
    expect(await h.chooseAssignment(id, async () => md)).toEqual({ ok: true });
    expect((await store.find(id))!.assignment).toContain("# Rechner");
  });
});

describe("package on disk", () => {
  it("exercise.yaml is plain exercise format", async () => {
    const id = await make("Titel");
    await store.addClass(id, "Hund");
    const yaml = await readFile(join(tmp, "scratch", id, "exercise.yaml"), "utf8");
    expect(yaml).toContain(`id: ${id}`);
    expect(yaml).toContain("mainFile: Main.java");
    expect(yaml).toContain("path: Hund.java");
  });
});

describe("import", () => {
  const SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'></svg>";
  const PACKAGE: Record<string, string> = {
    "exercise.yaml":
      "id: summe\ntitle: Summe\nfiles:\n  - path: Summe.java\n  - path: Hilfe.java\n    editable: false\nmainFile: Summe.java\nimages:\n  - path: bild.svg\ndifficulty: advanced\n",
    "aufgabe.md": "# Summe\n",
    "tests.yaml": 'tests:\n  - {name: a, type: io, expected: "1"}\n  - {name: b, type: io, expected: "2"}\n',
    "files/Summe.java": "class Summe {}",
    "files/Hilfe.java": "class Hilfe {}",
    "files/bild.svg": SVG
  };

  async function folder(files: Record<string, string> = PACKAGE, name = "summe"): Promise<string> {
    const dir = join(tmp, "src", name);
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(join(dir, rel, ".."), { recursive: true });
      await writeFile(join(dir, rel), content, "utf8");
    }
    return dir;
  }

  async function zip(files: Record<string, string> = PACKAGE, wrapper = ""): Promise<string> {
    const z: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(files)) z[wrapper + k] = strToU8(v);
    const p = join(tmp, `${wrapper ? "wrapped" : "flat"}.zip`);
    await writeFile(p, zipSync(z));
    return p;
  }

  async function imported(kind: "folder" | "zip", source: string): Promise<string> {
    const r = await store.importExercise(kind, source);
    if (!r.ok) throw new Error(r.message);
    return r.id;
  }

  it("imports a folder as a new scratch item with tests, image and difficulty", async () => {
    const id = await imported("folder", await folder());
    expect(isScratchId(id)).toBe(true);
    const ex = (await store.find(id))!;
    expect(ex.id).toBe(id);
    expect(ex.title).toBe("Summe");
    expect(ex.difficulty).toBe("advanced");
    expect(ex.tests).toHaveLength(2);
    expect(ex.imageContents["bild.svg"]).toBe(SVG);
    expect(ex.originals["Hilfe.java"]).toBe("class Hilfe {}");
    expect(ex.files.find((f) => f.path === "Hilfe.java")!.editable).toBe(false);
    expect(ex.assignment).toBe("# Summe\n");
    const { exercises, imported: info } = await store.list();
    expect(exercises.map((e) => e.id)).toEqual([id]);
    expect(scratchEntry(exercises[0]!, info.get(id))).toMatchObject({ imported: true, testCount: 2, difficulty: "advanced", scratch: true });
  });

  it("imports a flat zip and a zip with one wrapping folder the same way", async () => {
    const a = await imported("zip", await zip());
    const b = await imported("zip", await zip(PACKAGE, "summe/"));
    for (const id of [a, b]) {
      const ex = (await store.find(id))!;
      expect(ex.tests).toHaveLength(2);
      expect(ex.files.map((f) => f.path)).toEqual(["Summe.java", "Hilfe.java"]);
    }
  });

  it("importing the same exercise again adds a second copy", async () => {
    const dir = await folder();
    const a = await imported("folder", dir);
    const b = await imported("folder", dir);
    expect(a).not.toBe(b);
    expect((await store.list()).exercises).toHaveLength(2);
  });

  it("an exercise without tests.yaml imports with zero tests", async () => {
    const { "tests.yaml": _t, ...noTests } = PACKAGE;
    const id = await imported("folder", await folder(noTests));
    expect((await store.find(id))!.tests).toBeUndefined();
    expect((await store.importedInfo(id))!.tests).toBe(0);
  });

  it("gives the German parser errors for invalid input and leaves nothing behind", async () => {
    const bad = await store.importExercise("folder", await folder({ ...PACKAGE, "exercise.yaml": "id: x\n" }, "kaputt"));
    expect(!bad.ok && bad.message).toContain("exercise.yaml ist ungültig");
    const empty = join(tmp, "leer");
    await mkdir(empty);
    const r = await store.importExercise("folder", empty);
    expect(!r.ok && r.message).toContain("exercise.yaml fehlt");
    const notZip = join(tmp, "x.zip");
    await writeFile(notZip, "hallo");
    const z = await store.importExercise("zip", notZip);
    expect(!z.ok && z.message).toContain("kein gültiges ZIP");
    const slip = join(tmp, "slip.zip");
    await writeFile(slip, zipSync({ "../evil.txt": strToU8("x"), "exercise.yaml": strToU8(PACKAGE["exercise.yaml"]!) }));
    expect((await store.importExercise("zip", slip)).ok).toBe(false);
    expect((await store.importExercise("zip", join(tmp, "missing.zip"))).ok).toBe(false);
    expect((await store.importExercise("folder", join(tmp, "missing"))).ok).toBe(false);
    expect((await store.importExercise("pdf", "x")).ok).toBe(false);
    expect((await store.list()).exercises).toEqual([]);
  });

  it("classes that came with the exercise cannot be deleted, added ones can", async () => {
    const id = await imported("folder", await folder());
    const refused = await store.deleteClass(id, "Hilfe.java", ws);
    expect(!refused.ok && refused.message).toContain("importierten Aufgabe");
    expect((await store.deleteClass(id, "Summe.java", ws)).ok).toBe(false);
    expect((await store.find(id))!.files).toHaveLength(2);
    expect(await store.addClass(id, "Extra")).toEqual({ ok: true, path: "Extra.java" });
    expect((await store.importedInfo(id))!.files).toEqual(["Summe.java", "Hilfe.java"]);
    expect(await store.deleteClass(id, "Extra.java", ws)).toEqual({ ok: true });
  });

  it("rename and delete work like for other items; images and tests survive a rename", async () => {
    const id = await imported("folder", await folder());
    expect(await store.rename(id, "Meine Summe")).toEqual({ ok: true });
    const ex = (await store.find(id))!;
    expect(ex.title).toBe("Meine Summe");
    expect(ex.tests).toHaveLength(2);
    expect(ex.images).toHaveLength(1);
    expect(await store.delete(id, ws)).toEqual({ ok: true });
    expect(await store.find(id)).toBeUndefined();
  });

  it("the handlers refuse in exam mode and report a canceled dialog", async () => {
    const off = scratchHandlers(() => undefined, () => ws);
    expect(await off.importExercise("folder", async () => "x")).toEqual({ ok: false, message: SCRATCH_NOT_ALLOWED_MESSAGE });
    expect(await off.importPath("folder", "x")).toEqual({ ok: false, message: SCRATCH_NOT_ALLOWED_MESSAGE });
    const h = scratchHandlers(() => store, () => ws);
    expect(await h.importExercise("zip", async () => undefined)).toEqual({ ok: true, canceled: true });
    const r = await h.importExercise("folder", async () => folder());
    expect(r.ok && r.id !== undefined && isScratchId(r.id)).toBe(true);
  });

  describe("copyExercise (In Scratch kopieren)", () => {
    async function original(): Promise<Exercise> {
      return loadExercise(await folder());
    }

    it("neu beginnen: starter files, tests, image, difficulty, title; imported.json locks the classes", async () => {
      const ex = await original();
      // the student worked on the original; "fresh" ignores that
      await mkdir(join(ws, "summe"), { recursive: true });
      await writeFile(join(ws, "summe", "Summe.java"), "class Summe { /* mein Code */ }", "utf8");
      const r = await store.copyExercise(ex, "fresh", ws);
      if (!r.ok) throw new Error(r.message);
      expect(isScratchId(r.id)).toBe(true);
      const copy = (await store.find(r.id))!;
      expect(copy.title).toBe("Summe");
      expect(copy.difficulty).toBe("advanced");
      expect(copy.tests).toHaveLength(2);
      expect(copy.imageContents["bild.svg"]).toBe(SVG);
      expect(copy.assignment).toBe("# Summe\n");
      expect(copy.originals["Summe.java"]).toBe("class Summe {}");
      expect(copy.originals["Hilfe.java"]).toBe("class Hilfe {}");
      expect(await store.importedInfo(r.id)).toEqual({ files: ["Summe.java", "Hilfe.java"], tests: 2, copy: true });
      const refused = await store.deleteClass(r.id, "Hilfe.java", ws);
      expect(refused.ok).toBe(false);
    });

    it("mit meinem Code: the working copy of the editable files; the original workspace is untouched", async () => {
      const ex = await original();
      await mkdir(join(ws, "summe"), { recursive: true });
      await writeFile(join(ws, "summe", "Summe.java"), "class Summe { /* mein Code */ }", "utf8");
      const r = await store.copyExercise(ex, "mine", ws);
      if (!r.ok) throw new Error(r.message);
      const copy = (await store.find(r.id))!;
      expect(copy.originals["Summe.java"]).toBe("class Summe { /* mein Code */ }");
      expect(copy.originals["Hilfe.java"]).toBe("class Hilfe {}"); // not editable: from the package
      expect(copy.tests).toHaveLength(2);
      expect(await readFile(join(ws, "summe", "Summe.java"), "utf8")).toBe("class Summe { /* mein Code */ }");
      expect(await exists(join(ws, r.id))).toBe(false); // not opened
    });

    it("mit meinem Code without a local copy uses the starter files and creates no workspace", async () => {
      const ex = await original();
      const r = await store.copyExercise(ex, "mine", ws);
      if (!r.ok) throw new Error(r.message);
      expect((await store.find(r.id))!.originals["Summe.java"]).toBe("class Summe {}");
      expect(await exists(join(ws, "summe"))).toBe(false);
    });

    it("mit meinem Code of a graded exercise copies the graded hand-in, not the workspace", async () => {
      const ex = await original();
      await mkdir(join(ws, "summe"), { recursive: true });
      await writeFile(join(ws, "summe", "Summe.java"), "class Summe { /* neuer Entwurf */ }", "utf8");
      const r = await store.copyExercise(ex, "mine", ws, [{ path: "Summe.java", content: "class Summe { /* beurteilt */ }" }]);
      if (!r.ok) throw new Error(r.message);
      const copy = (await store.find(r.id))!;
      expect(copy.originals["Summe.java"]).toBe("class Summe { /* beurteilt */ }");
      expect(copy.originals["Hilfe.java"]).toBe("class Hilfe {}");
      // "Neu beginnen" ignores the graded files
      const fresh = await store.copyExercise(ex, "fresh", ws, [{ path: "Summe.java", content: "x" }]);
      if (!fresh.ok) throw new Error(fresh.message);
      expect((await store.find(fresh.id))!.originals["Summe.java"]).toBe("class Summe {}");
    });

    it("the handler passes the graded files for mine and reports an unavailable grade", async () => {
      const ex = await original();
      const find = async () => ex;
      const graded = scratchHandlers(() => store, () => ws, find, async () => ({
        ok: true,
        grade: { symbol: "PLUS", comment: "", gradedAt: "", handinId: 1, submittedAt: "", files: [{ path: "Summe.java", content: "class Summe { /* g */ }" }], lineComments: [] }
      }));
      const r = await graded.copyExercise("summe", "mine");
      if (!r.ok) throw new Error(r.message);
      expect((await store.find(r.id))!.originals["Summe.java"]).toBe("class Summe { /* g */ }");
      const offline = scratchHandlers(() => store, () => ws, find, async () => ({ ok: false, message: "offline" }));
      expect(await offline.copyExercise("summe", "mine")).toEqual({ ok: false, message: "offline" });
      expect((await offline.copyExercise("summe", "fresh")).ok).toBe(true); // starter code needs no grade
    });

    it("copies twice into two items, an exercise without tests gets zero tests", async () => {
      const { "tests.yaml": _t, ...rest } = PACKAGE;
      const ex = await loadExercise(await folder(rest, "ohne"));
      const a = await store.copyExercise(ex, "fresh", ws);
      const b = await store.copyExercise(ex, "fresh", ws);
      expect(a.ok && b.ok && a.id !== b.id).toBe(true);
      if (a.ok) expect(await store.importedInfo(a.id)).toMatchObject({ tests: 0 });
      expect((await store.list()).exercises).toHaveLength(2);
    });

    it("refuses an unknown exercise and a bad mode, leaving nothing behind", async () => {
      const ex = await original();
      expect((await store.copyExercise(undefined, "fresh", ws)).ok).toBe(false);
      expect((await store.copyExercise(ex, "x", ws)).ok).toBe(false);
      expect((await store.list()).exercises).toEqual([]);
    });

    it("the handler: refused in exam mode, unavailable package, Scratch ids, success", async () => {
      const ex = await original();
      const find = async (id: unknown) => (id === "summe" ? ex : undefined);
      const off = scratchHandlers(() => undefined, () => ws, find);
      expect(await off.copyExercise("summe", "fresh")).toEqual({ ok: false, message: SCRATCH_NOT_ALLOWED_MESSAGE });
      const h = scratchHandlers(() => store, () => ws, find);
      expect(await h.copyExercise("andere", "fresh")).toEqual({ ok: false, message: COPY_UNAVAILABLE_MESSAGE });
      const own = await make();
      expect(await h.copyExercise(own, "fresh")).toEqual({ ok: false, message: COPY_UNAVAILABLE_MESSAGE });
      const r = await h.copyExercise("summe", "mine");
      expect(r.ok && isScratchId(r.id)).toBe(true);
    });
  });
});
