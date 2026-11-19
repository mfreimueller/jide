import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExercise, openWorkspace, type Exercise } from "@jide/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompositeSource } from "./composite-source";
import { classNameProblem, isScratchId, ScratchStore } from "./scratch";
import { SCRATCH_NOT_ALLOWED_MESSAGE, scratchHandlers } from "./scratch-handlers";
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
