import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadExercise, saveFile, type Exercise } from "@jide/shared";
import { projectFileName, PROJECT_SAVE_NOT_ALLOWED_MESSAGE, saveProject, type ProjectSaveDeps } from "./project-save";
import { ScratchStore } from "./scratch";

const examples = resolve(__dirname, "../../../examples");
let tmp: string;
let ex: Exercise;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "jide-save-"));
  ex = await loadExercise(join(examples, "summe"));
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

function deps(over: Partial<ProjectSaveDeps> = {}): ProjectSaveDeps & { written: Map<string, Uint8Array> } {
  const written = new Map<string, Uint8Array>();
  return {
    written,
    examMode: () => false,
    find: async (id) => (id === ex.id ? ex : undefined),
    workspaceRoot: () => join(tmp, "ws"),
    gradedView: async () => null,
    pick: async () => join(tmp, "out.zip"),
    write: async (p, b) => void written.set(p, b),
    ...over
  };
}

describe("projectFileName", () => {
  it("keeps the title, replaces unsafe characters, always ends in .zip", () => {
    expect(projectFileName("Summe zweier Zahlen")).toBe("Summe zweier Zahlen.zip");
    expect(projectFileName("Größe: a/b\\c?")).toBe("Größe_ a_b_c_.zip");
    expect(projectFileName("../..")).toBe("programm.zip");
    expect(projectFileName(undefined)).toBe("programm.zip");
    expect(projectFileName("x".repeat(200)).length).toBe(64);
  });
});

describe("saveProject", () => {
  it("round trip: the saved workspace code is what Importieren brings back, with assignment and tests", async () => {
    const mine = 'void main() { IO.println("meins"); }\n';
    await saveFile(ex, join(tmp, "ws"), ex.mainFile, mine);
    const d = deps();
    expect(await saveProject(ex.id, d)).toEqual({ ok: true });
    const zip = d.written.get(join(tmp, "out.zip"))!;
    await writeFile(join(tmp, "out.zip"), zip);

    const store = new ScratchStore(join(tmp, "scratch"));
    const r = await store.importExercise("zip", join(tmp, "out.zip"));
    expect(r.ok).toBe(true);
    const imported = (await store.find((r as { id: string }).id))!;
    expect(imported.originals[ex.mainFile]).toBe(mine);
    expect(imported.assignment).toBe(ex.assignment);
    expect(imported.tests).toEqual(ex.tests);
    expect(imported.tests?.length).toBeGreaterThan(0);
    expect((await store.importedInfo(imported.id))?.tests).toBe(ex.tests?.length);
    expect(await readFile(join(imported.dir, "files", ex.mainFile), "utf8")).toBe(mine);
  });

  it("proposes the title as file name and writes nothing when the dialog is canceled", async () => {
    const pick = vi.fn(async () => undefined);
    const d = deps({ pick });
    expect(await saveProject(ex.id, d)).toEqual({ ok: true, canceled: true });
    expect(pick).toHaveBeenCalledWith(projectFileName(ex.title));
    expect(d.written.size).toBe(0);
  });

  it("is refused in exam mode, before anything is read or asked", async () => {
    const pick = vi.fn(async () => "x.zip");
    const find = vi.fn(async () => ex);
    expect(await saveProject(ex.id, deps({ examMode: () => true, pick, find }))).toEqual({ ok: false, message: PROJECT_SAVE_NOT_ALLOWED_MESSAGE });
    expect(pick).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  it("only knows exercise ids; an arbitrary string or path is an unknown exercise", async () => {
    const pick = vi.fn(async () => "x.zip");
    for (const id of ["/etc/passwd", "../x", 42, undefined]) {
      expect(await saveProject(id, deps({ pick }))).toEqual({ ok: false, message: "Diese Aufgabe gibt es nicht." });
    }
    expect(pick).not.toHaveBeenCalled();
  });

  it("a graded exercise saves the graded hand-in; a refused graded view shows its message", async () => {
    const grade = { files: [{ path: ex.mainFile, content: "// abgegeben\n" }] };
    const d = deps({ gradedView: async () => ({ ok: true, grade } as never) });
    await saveProject(ex.id, d);
    const store = new ScratchStore(join(tmp, "scratch"));
    await writeFile(join(tmp, "g.zip"), d.written.get(join(tmp, "out.zip"))!);
    const r = (await store.importExercise("zip", join(tmp, "g.zip"))) as { id: string };
    expect((await store.find(r.id))!.originals[ex.mainFile]).toBe("// abgegeben\n");

    expect(await saveProject(ex.id, deps({ gradedView: async () => ({ ok: false, message: "Offline." }) }))).toEqual({ ok: false, message: "Offline." });
  });

  it("a write error is reported in German with the code", async () => {
    const err = Object.assign(new Error("x"), { code: "EACCES" });
    const r = await saveProject(ex.id, deps({ write: async () => Promise.reject(err) }));
    expect(r).toEqual({ ok: false, message: "Die Datei konnte nicht gespeichert werden (EACCES)." });
  });
});
