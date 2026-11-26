import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildExerciseZip, loadExercise, readExerciseZip } from "./index";

const examplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../examples");

describe("buildExerciseZip", () => {
  it("round trip: the student's code replaces the starter code, assignment and tests stay", async () => {
    const ex = await loadExercise(path.join(examplesDir, "summe"), { strict: true });
    const testsYaml = await readFile(path.join(examplesDir, "summe", "tests.yaml"), "utf8");
    const mine = { [ex.mainFile]: "void main() { IO.println(\"mein Code\"); }\n" };

    const pkg = await readExerciseZip(buildExerciseZip(ex, mine, testsYaml), { strict: true });

    expect(pkg.exercise.originals[ex.mainFile]).toBe(mine[ex.mainFile]);
    expect(Object.keys(pkg.exercise.originals)).toEqual(Object.keys(ex.originals));
    expect(pkg.exercise.title).toBe(ex.title);
    expect(pkg.exercise.kind).toBe(ex.kind);
    expect(pkg.exercise.mainFile).toBe(ex.mainFile);
    expect(pkg.exercise.assignment).toBe(ex.assignment);
    expect(pkg.exercise.tests).toEqual(ex.tests);
    expect(pkg.exercise.tests?.length).toBeGreaterThan(0);
  });

  it("round trip with a harness: harness file and non-editable files are kept, editable ones replaced", async () => {
    const ex = await loadExercise(path.join(examplesDir, "maximum"), { strict: true });
    expect(ex.harness).toBeDefined();
    const editable = ex.files.find((f) => f.editable)!.path;
    const pkg = await readExerciseZip(buildExerciseZip(ex, { [editable]: "// meins\n" }), { strict: true });

    expect(pkg.exercise.harness).toEqual(ex.harness);
    expect(pkg.exercise.harnessContent).toBe(ex.harnessContent);
    expect(pkg.exercise.originals[editable]).toBe("// meins\n");
    for (const f of ex.files.filter((f) => !f.editable)) expect(pkg.exercise.originals[f.path]).toBe(ex.originals[f.path]);
    expect(pkg.exercise.tests).toBeUndefined();
  });

  it("ignores content given for a read-only file and falls back to the starter code for a missing one", async () => {
    const ex = await loadExercise(path.join(examplesDir, "maximum"), { strict: true });
    const readOnly = ex.files.find((f) => !f.editable);
    const current = readOnly ? { [readOnly.path]: "manipuliert" } : {};
    const pkg = await readExerciseZip(buildExerciseZip(ex, current), { strict: true });
    for (const f of ex.files) expect(pkg.exercise.originals[f.path]).toBe(ex.originals[f.path]);
  });

  it("keeps images", async () => {
    const ex = await loadExercise(path.join(examplesDir, "summe"));
    const withImage = { ...ex, images: [{ path: "bild.svg", title: "Bild" }], imageContents: { "bild.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>" } };
    const pkg = await readExerciseZip(buildExerciseZip(withImage, {}), { strict: true });
    expect(pkg.exercise.images).toEqual([{ path: "bild.svg", title: "Bild" }]);
    expect(pkg.exercise.imageContents["bild.svg"]).toBe(withImage.imageContents["bild.svg"]);
  });
});
