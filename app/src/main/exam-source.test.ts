import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadExercise, openWorkspace, saveFile, type Exercise } from "@jide/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExamSource, type SaveReport } from "./exam-source";

const examples = resolve(__dirname, "../../../examples");
let tmp: string;
let drive: string;
let ex: Exercise;
let reports: SaveReport[];
let name: string | null;

function source(handInPath = drive): ExamSource {
  return new ExamSource(join(examples), { handInPath, getName: () => name, onReport: (r) => reports.push(r) });
}

const FILE = () => ex.files.find((f) => f.editable)!.path;

async function workspaceText(root: string): Promise<string> {
  return readFile(join(root, ex.id, FILE()), "utf8");
}

async function put(dir: string, text: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, FILE()), text);
}

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "jide-exam-source-"));
  drive = join(tmp, "P");
  await mkdir(drive);
  ex = await loadExercise(join(examples, "summe"));
  reports = [];
  name = "Max Muster";
});
afterEach(() => rm(tmp, { recursive: true, force: true }));

describe("hand-in", () => {
  it("writes the editable files and abgabe.json, and restores them on another PC", async () => {
    const src = source();
    const root = join(tmp, "ws1");
    await src.prepareWorkspace(ex, root, false);
    await openWorkspace(ex, root);
    await saveFile(ex, root, FILE(), "// meine Abgabe\n");
    const r = await src.handIn(ex, [{ path: FILE(), content: "// meine Abgabe\n" }], { passed: 2, total: 3 });
    expect(r).toMatchObject({ ok: true, late: false });

    const dir = join(drive, ex.id);
    expect(await readFile(join(dir, FILE()), "utf8")).toBe("// meine Abgabe\n");
    const abgabe = JSON.parse(await readFile(join(dir, "abgabe.json"), "utf8"));
    expect(abgabe).toMatchObject({ name: "Max Muster", exercise: ex.id, title: ex.title, testSummary: { passed: 2, total: 3 }, files: [FILE()] });
    expect(abgabe.submittedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
    expect((await readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect(reports.at(-1)?.ok).toBe(true);

    // another PC, empty workspace
    const root2 = join(tmp, "ws2");
    const p = await source().prepareWorkspace(ex, root2, false);
    expect(p).toMatchObject({ ok: true, submittedAt: new Date(abgabe.submittedAt).toISOString() });
    expect(await workspaceText(root2)).toBe("// meine Abgabe\n");
  });

  it("a missing drive gives the Figma 11 message and keeps the work", async () => {
    const gone = join(tmp, "nicht-da");
    const src = source(gone);
    const r = await src.handIn(ex, [{ path: FILE(), content: "x" }], null);
    expect(r).toEqual({
      ok: false,
      message: `Abgabe nicht gespeichert – ${gone} ist nicht erreichbar. Versuch es gleich nochmal.`
    });
    expect(reports.map((x) => x.ok)).toEqual([false]);
    await expect(readdir(gone)).rejects.toThrow(); // the drive folder is not created
  });
});

describe("restore", () => {
  it("takes the autosave if it is newer than the hand-in", async () => {
    const dir = join(drive, ex.id);
    await put(dir, "// hand-in\n");
    await writeFile(join(dir, "abgabe.json"), JSON.stringify({ name: "Max Muster", submittedAt: "2026-12-03T10:00:00+01:00" }));
    await put(join(dir, "_autosave"), "// autosave\n");
    await writeFile(join(dir, "_autosave", "autosave.json"), JSON.stringify({ name: "max muster ", savedAt: "2026-12-03T10:05:00+01:00" }));
    const root = join(tmp, "ws");
    const p = await source().prepareWorkspace(ex, root, false);
    expect(await workspaceText(root)).toBe("// autosave\n");
    expect(p).toMatchObject({ ok: true, submittedAt: "2026-12-03T09:00:00.000Z" }); // still "abgegeben"
  });

  it("takes the hand-in if it is newer than the autosave", async () => {
    const dir = join(drive, ex.id);
    await put(dir, "// hand-in\n");
    await writeFile(join(dir, "abgabe.json"), JSON.stringify({ name: "Max Muster", submittedAt: "2026-12-03T10:10:00+01:00" }));
    await put(join(dir, "_autosave"), "// autosave\n");
    await writeFile(join(dir, "_autosave", "autosave.json"), JSON.stringify({ name: "Max Muster", savedAt: "2026-12-03T10:05:00+01:00" }));
    const root = join(tmp, "ws");
    await source().prepareWorkspace(ex, root, false);
    expect(await workspaceText(root)).toBe("// hand-in\n");
  });

  it("the local workspace wins when it is newer than the drive", async () => {
    const dir = join(drive, ex.id);
    await put(join(dir, "_autosave"), "// alt\n");
    await writeFile(join(dir, "_autosave", "autosave.json"), JSON.stringify({ name: "Max Muster", savedAt: "2020-01-01T10:00:00+01:00" }));
    const root = join(tmp, "ws");
    await openWorkspace(ex, root);
    await saveFile(ex, root, FILE(), "// lokal\n");
    await source().prepareWorkspace(ex, root, true);
    expect(await workspaceText(root)).toBe("// lokal\n");
  });

  it("ignores autosave and hand-in of another name", async () => {
    const dir = join(drive, ex.id);
    await put(dir, "// fremd\n");
    await writeFile(join(dir, "abgabe.json"), JSON.stringify({ name: "Erika Muster", submittedAt: "2026-12-03T10:10:00+01:00" }));
    await put(join(dir, "_autosave"), "// fremd\n");
    await writeFile(join(dir, "_autosave", "autosave.json"), JSON.stringify({ name: "Erika Muster", savedAt: "2026-12-03T10:05:00+01:00" }));
    const root = join(tmp, "ws");
    const p = await source().prepareWorkspace(ex, root, false);
    expect(p).toEqual({ ok: true });
    await openWorkspace(ex, root);
    expect(await workspaceText(root)).toBe(ex.originals[FILE()]);
  });

  it("an unreachable drive means starter code, or the local workspace", async () => {
    const gone = join(tmp, "nicht-da");
    const root = join(tmp, "ws");
    expect(await source(gone).prepareWorkspace(ex, root, false)).toEqual({ ok: true });
    await openWorkspace(ex, root);
    await saveFile(ex, root, FILE(), "// lokal\n");
    expect(await source(gone).prepareWorkspace(ex, root, true)).toEqual({ ok: true });
    expect(await workspaceText(root)).toBe("// lokal\n");
  });

  it("restores only the editable files of exercise.yaml and ignores other files", async () => {
    const dir = join(drive, ex.id);
    await put(join(dir, "_autosave"), "// autosave\n");
    await writeFile(join(dir, "_autosave", "Fremd.java"), "class Fremd {}");
    await writeFile(join(dir, "_autosave", "autosave.json"), JSON.stringify({ name: "Max Muster", savedAt: "2026-12-03T10:05:00+01:00" }));
    const root = join(tmp, "ws");
    await source().prepareWorkspace(ex, root, false);
    expect((await readdir(join(root, ex.id))).sort()).toEqual([FILE()]);
  });
});

describe("autosave", () => {
  async function opened(src: ExamSource, root: string): Promise<void> {
    await src.prepareWorkspace(ex, root, false);
    await openWorkspace(ex, root);
  }

  it("writes _autosave with autosave.json, and skips when nothing changed", async () => {
    const src = source();
    const root = join(tmp, "ws");
    await opened(src, root);
    await saveFile(ex, root, FILE(), "// v1\n");
    await src.autosave(root);
    const dir = join(drive, ex.id, "_autosave");
    expect(await readFile(join(dir, FILE()), "utf8")).toBe("// v1\n");
    expect(JSON.parse(await readFile(join(dir, "autosave.json"), "utf8"))).toMatchObject({ name: "Max Muster", exercise: ex.id });
    expect(reports).toHaveLength(1);

    await src.autosave(root);
    expect(reports).toHaveLength(1); // unchanged: nothing written, no new report
    await saveFile(ex, root, FILE(), "// v2\n");
    await src.autosave(root);
    expect(reports).toHaveLength(2);
    expect(await readFile(join(dir, FILE()), "utf8")).toBe("// v2\n");
  });

  it("only saves exercises opened in this session", async () => {
    const src = source();
    await src.autosave(join(tmp, "ws"));
    expect(reports).toHaveLength(0);
    await expect(readdir(join(drive, ex.id))).rejects.toThrow();
  });

  it("an unreachable drive reports a failure, and the retry saves once it is back", async () => {
    const gone = join(tmp, "spaeter");
    const src = source(gone);
    const root = join(tmp, "ws");
    await opened(src, root);
    await src.autosave(root);
    expect(reports.map((r) => r.ok)).toEqual([false]);
    await mkdir(gone);
    await src.autosave(root);
    expect(reports.map((r) => r.ok)).toEqual([false, true]);
    expect((await readdir(join(gone, ex.id, "_autosave"))).sort()).toEqual([FILE(), "autosave.json"].sort());
  });
});

describe("hasUnsubmittedChanges", () => {
  it("false for the starter code, true after a change, false after a hand-in, true after another change", async () => {
    const src = source();
    const root = join(tmp, "ws");
    await src.prepareWorkspace(ex, root, false);
    await openWorkspace(ex, root);
    expect(await src.hasUnsubmittedChanges(root)).toBe(false);
    await saveFile(ex, root, FILE(), "// neu\n");
    expect(await src.hasUnsubmittedChanges(root)).toBe(true);
    await src.handIn(ex, [{ path: FILE(), content: "// neu\n" }], null);
    expect(await src.hasUnsubmittedChanges(root)).toBe(false);
    await saveFile(ex, root, FILE(), "// neuer\n");
    expect(await src.hasUnsubmittedChanges(root)).toBe(true);
  });

  it("compares with the hand-in on the drive after a restart", async () => {
    const root = join(tmp, "ws");
    const first = source();
    await first.prepareWorkspace(ex, root, false);
    await openWorkspace(ex, root);
    await saveFile(ex, root, FILE(), "// abgegeben\n");
    await first.handIn(ex, [{ path: FILE(), content: "// abgegeben\n" }], null);

    const second = source();
    await second.prepareWorkspace(ex, root, true);
    expect(await second.hasUnsubmittedChanges(root)).toBe(false);
  });
});
