import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExerciseError, loadExercise, openWorkspace, resetFile, saveFile, type Exercise } from "./index";

const examplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../examples");

let tmp: string;
let wsRoot: string;
beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "jide-ws-"));
  wsRoot = path.join(tmp, "ws");
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/** Exercise with one editable (A.java) and one read-only (B.java) file. */
async function makeMixed(): Promise<{ dir: string; ex: Exercise }> {
  const dir = path.join(tmp, "mixed");
  await mkdir(path.join(dir, "files"), { recursive: true });
  await writeFile(
    path.join(dir, "exercise.yaml"),
    "id: mixed\ntitle: T\nfiles:\n  - path: A.java\n  - path: B.java\n    editable: false\nmainFile: A.java\n",
  );
  await writeFile(path.join(dir, "aufgabe.md"), "x");
  await writeFile(path.join(dir, "files", "A.java"), "class A {}");
  await writeFile(path.join(dir, "files", "B.java"), "class B {}");
  return { dir, ex: await loadExercise(dir) };
}

describe("workspace", () => {
  it("copies editable files on first open (examples/summe)", async () => {
    const ex = await loadExercise(path.join(examplesDir, "summe"));
    const ws = await openWorkspace(ex, wsRoot);
    expect(ws.dir).toBe(path.join(wsRoot, "summe"));
    expect(ws.files).toEqual([{ path: "Summe.java", content: ex.originals["Summe.java"], editable: true }]);
    expect(await readFile(path.join(ws.dir, "Summe.java"), "utf8")).toBe(ex.originals["Summe.java"]);
  });

  it("works for examples/maximum (harness not copied)", async () => {
    const ex = await loadExercise(path.join(examplesDir, "maximum"));
    const ws = await openWorkspace(ex, wsRoot);
    expect(await readdir(ws.dir)).toEqual(["Maximum.java"]);
  });

  it("only copies editable files", async () => {
    const { ex } = await makeMixed();
    const ws = await openWorkspace(ex, wsRoot);
    expect(await readdir(ws.dir)).toEqual(["A.java"]);
    expect(ws.files.map((f) => f.path)).toEqual(["A.java", "B.java"]);
  });

  it("keeps a modified student file on reopen", async () => {
    const { ex } = await makeMixed();
    const ws = await openWorkspace(ex, wsRoot);
    await writeFile(path.join(ws.dir, "A.java"), "student");
    const again = await openWorkspace(ex, wsRoot);
    expect(again.files[0]!.content).toBe("student");
  });

  it("adds a new editable file on reopen and keeps existing ones", async () => {
    const { dir, ex } = await makeMixed();
    const ws = await openWorkspace(ex, wsRoot);
    await writeFile(path.join(ws.dir, "A.java"), "student");
    await writeFile(
      path.join(dir, "exercise.yaml"),
      "id: mixed\ntitle: T\nfiles:\n  - path: A.java\n  - path: B.java\n    editable: false\n  - path: C.java\nmainFile: A.java\n",
    );
    await writeFile(path.join(dir, "files", "C.java"), "class C {}");
    const again = await openWorkspace(await loadExercise(dir), wsRoot);
    expect(again.files.map((f) => [f.path, f.content])).toEqual([
      ["A.java", "student"],
      ["B.java", "class B {}"],
      ["C.java", "class C {}"],
    ]);
  });

  it("takes read-only content from the exercise", async () => {
    const { dir, ex } = await makeMixed();
    await openWorkspace(ex, wsRoot);
    await writeFile(path.join(dir, "files", "B.java"), "class B2 {}");
    const again = await openWorkspace(await loadExercise(dir), wsRoot);
    const b = again.files.find((f) => f.path === "B.java")!;
    expect(b).toEqual({ path: "B.java", content: "class B2 {}", editable: false });
  });

  it("saveFile rejects read-only and unknown paths", async () => {
    const { ex } = await makeMixed();
    await openWorkspace(ex, wsRoot);
    const ro = await saveFile(ex, wsRoot, "B.java", "x").catch((e: unknown) => e);
    expect(ro).toBeInstanceOf(ExerciseError);
    expect((ro as Error).message).toBe('Aufgabe "mixed": Datei B.java ist schreibgeschützt.');
    const unknown = await saveFile(ex, wsRoot, "../evil.java", "x").catch((e: unknown) => e);
    expect(unknown).toBeInstanceOf(ExerciseError);
    expect((unknown as Error).message).toBe('Aufgabe "mixed": Datei ../evil.java gehört nicht zur Aufgabe.');
  });

  it("saveFile then reopen returns saved content, leaves no temp files", async () => {
    const { ex } = await makeMixed();
    await openWorkspace(ex, wsRoot);
    await saveFile(ex, wsRoot, "A.java", "saved");
    const ws = await openWorkspace(ex, wsRoot);
    expect(ws.files[0]!.content).toBe("saved");
    expect(await readdir(ws.dir)).toEqual(["A.java"]);
  });

  it("resetFile restores the original", async () => {
    const { ex } = await makeMixed();
    await openWorkspace(ex, wsRoot);
    await saveFile(ex, wsRoot, "A.java", "changed");
    await resetFile(ex, wsRoot, "A.java");
    const ws = await openWorkspace(ex, wsRoot);
    expect(ws.files[0]!.content).toBe("class A {}");
    await expect(resetFile(ex, wsRoot, "B.java")).rejects.toBeInstanceOf(ExerciseError);
  });
});
