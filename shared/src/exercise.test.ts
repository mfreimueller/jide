import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExerciseError, listExercises, loadExercise } from "./index";

const examplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../examples");

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "jide-ex-"));
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

interface Opts {
  yaml?: string;
  files?: Record<string, string>;
  harness?: Record<string, string>;
  aufgabe?: boolean;
}
async function make(name: string, o: Opts = {}): Promise<string> {
  const dir = path.join(tmp, name);
  await mkdir(dir, { recursive: true });
  const yaml = o.yaml ?? `id: ${name}\ntitle: T\nfiles:\n  - path: A.java\nmainFile: A.java\n`;
  await writeFile(path.join(dir, "exercise.yaml"), yaml);
  if (o.aufgabe !== false) await writeFile(path.join(dir, "aufgabe.md"), "# Hi");
  for (const [p, c] of Object.entries(o.files ?? { "A.java": "class A {}" })) {
    await mkdir(path.dirname(path.join(dir, "files", p)), { recursive: true });
    await writeFile(path.join(dir, "files", p), c);
  }
  for (const [p, c] of Object.entries(o.harness ?? {})) {
    await mkdir(path.dirname(path.join(dir, p)), { recursive: true });
    await writeFile(path.join(dir, p), c);
  }
  return dir;
}

async function expectError(dir: string, message: string | RegExp) {
  const err = await loadExercise(dir).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ExerciseError);
  if (typeof message === "string") expect((err as Error).message).toBe(message);
  else expect((err as Error).message).toMatch(message);
}

describe("loadExercise", () => {
  it("loads examples/summe", async () => {
    const ex = await loadExercise(path.join(examplesDir, "summe"));
    expect(ex.id).toBe("summe");
    expect(ex.files).toEqual([{ path: "Summe.java", editable: true }]);
    expect(ex.harness).toBeUndefined();
    expect(ex.harnessContent).toBeUndefined();
    expect(ex.assignment.length).toBeGreaterThan(0);
    expect(ex.originals["Summe.java"]).toContain("void main");
  });

  it("loads examples/maximum with harness", async () => {
    const ex = await loadExercise(path.join(examplesDir, "maximum"));
    expect(ex.harness).toEqual({ appendTo: "Maximum.java", file: "harness/Maximum.main.java" });
    expect(ex.harnessContent).toContain("main");
    expect(ex.mainFile).toBe("Maximum.java");
  });

  it("defaults editable to true", async () => {
    const ex = await loadExercise(await make("d"));
    expect(ex.files[0]!.editable).toBe(true);
  });

  it("rejects missing exercise.yaml", async () => {
    const dir = path.join(tmp, "leer");
    await mkdir(dir);
    await expectError(dir, 'Aufgabe "leer": Datei exercise.yaml fehlt.');
  });

  it("rejects invalid YAML", async () => {
    await expectError(
      await make("kaputt", { yaml: "id: [" }),
      /^Aufgabe "kaputt": exercise\.yaml ist kein gültiges YAML/,
    );
  });

  it("rejects invalid id", async () => {
    const y = "id: Foo_Bar\ntitle: T\nfiles:\n  - path: A.java\nmainFile: A.java\n";
    await expectError(await make("x", { yaml: y }), /^Aufgabe "x": exercise\.yaml ist ungültig: id darf nur/);
  });

  it("rejects empty title and empty files", async () => {
    await expectError(
      await make("t", { yaml: 'id: t\ntitle: ""\nfiles:\n  - path: A.java\nmainFile: A.java\n' }),
      /title darf nicht leer sein/,
    );
    await expectError(
      await make("f", { yaml: "id: f\ntitle: T\nfiles: []\nmainFile: A.java\n" }),
      /files darf nicht leer sein/,
    );
  });

  it.each([
    ["/abs/A.java", "muss relativ sein"],
    ["../A.java", 'darf kein ".." enthalten'],
    ["a/../A.java", 'darf kein ".." enthalten'],
    ["A.txt", "muss auf .java enden"],
  ])("rejects path %s", async (p, problem) => {
    const y = `id: p\ntitle: T\nfiles:\n  - path: "${p}"\nmainFile: "${p}"\n`;
    await expectError(await make("p", { yaml: y }), `Aufgabe "p": Dateipfad "${p}" ${problem}.`);
  });

  it("rejects duplicate paths", async () => {
    const y = "id: d\ntitle: T\nfiles:\n  - path: A.java\n  - path: A.java\nmainFile: A.java\n";
    await expectError(await make("d", { yaml: y }), 'Aufgabe "d": Dateipfad "A.java" ist doppelt aufgeführt.');
  });

  it("rejects mainFile not listed", async () => {
    const y = "id: m\ntitle: T\nfiles:\n  - path: A.java\nmainFile: B.java\n";
    await expectError(await make("m", { yaml: y }), 'Aufgabe "m": mainFile "B.java" ist nicht in files aufgeführt.');
  });

  it("rejects harness.appendTo not listed", async () => {
    const y =
      "id: h\ntitle: T\nfiles:\n  - path: A.java\nharness:\n  appendTo: B.java\n  file: harness/x.java\nmainFile: A.java\n";
    await expectError(
      await make("h", { yaml: y }),
      'Aufgabe "h": harness.appendTo "B.java" ist nicht in files aufgeführt.',
    );
  });

  it("rejects missing listed file", async () => {
    await expectError(await make("s", { files: {} }), 'Aufgabe "s": Datei files/A.java fehlt.');
  });

  it("rejects missing harness file", async () => {
    const y =
      "id: h\ntitle: T\nfiles:\n  - path: A.java\nharness:\n  appendTo: A.java\n  file: harness/x.java\nmainFile: A.java\n";
    await expectError(await make("h", { yaml: y }), 'Aufgabe "h": Harness-Datei harness/x.java fehlt.');
  });

  it("rejects missing aufgabe.md", async () => {
    await expectError(await make("a", { aufgabe: false }), 'Aufgabe "a": Datei aufgabe.md fehlt.');
  });
});

describe("images", () => {
  const imgYaml = (images: string, files = "  - path: A.java\n") =>
    `id: i\ntitle: T\nfiles:\n${files}mainFile: A.java\nimages:\n${images}`;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>";

  it("loads images with and without title", async () => {
    const dir = await make("i", {
      yaml: imgYaml("  - path: a.svg\n    title: Flussdiagramm\n  - path: sub/b.svg\n"),
      files: { "A.java": "class A {}", "a.svg": svg, "sub/b.svg": svg + " " },
    });
    const ex = await loadExercise(dir);
    expect(ex.images).toEqual([{ path: "a.svg", title: "Flussdiagramm" }, { path: "sub/b.svg" }]);
    expect(ex.imageContents["a.svg"]).toBe(svg);
    expect(ex.files.map((f) => f.path)).toEqual(["A.java"]);
    expect(Object.keys(ex.originals)).toEqual(["A.java"]);
  });

  it("behaves as before without images key", async () => {
    const ex = await loadExercise(await make("n"));
    expect(ex.images).toEqual([]);
    expect(ex.imageContents).toEqual({});
  });

  it.each([
    ["/abs/a.svg", "muss relativ sein"],
    ["../a.svg", 'darf kein ".." enthalten'],
    ["a.png", "muss auf .svg enden"],
  ])("rejects image path %s", async (p, problem) => {
    await expectError(
      await make("i", { yaml: imgYaml(`  - path: "${p}"\n`) }),
      `Aufgabe "i": Bildpfad "${p}" ${problem}.`,
    );
  });

  it("rejects duplicate images", async () => {
    await expectError(
      await make("i", { yaml: imgYaml("  - path: a.svg\n  - path: a.svg\n"), files: { "A.java": "x", "a.svg": svg } }),
      'Aufgabe "i": Bildpfad "a.svg" ist doppelt aufgeführt.',
    );
  });

  it("rejects an image that is also a Java file", async () => {
    // a .svg path can only collide with files when files lists it, which the Java check rejects first
    const y = imgYaml("  - path: A.java\n");
    await expectError(await make("i", { yaml: y }), 'Aufgabe "i": Bildpfad "A.java" muss auf .svg enden.');
  });

  it("rejects missing image file", async () => {
    await expectError(
      await make("i", { yaml: imgYaml("  - path: a.svg\n") }),
      'Aufgabe "i": Bilddatei files/a.svg fehlt.',
    );
  });

  it("rejects image over 2 MB", async () => {
    await expectError(
      await make("i", {
        yaml: imgYaml("  - path: a.svg\n"),
        files: { "A.java": "x", "a.svg": "a".repeat(2 * 1024 * 1024 + 1) },
      }),
      'Aufgabe "i": Bilddatei files/a.svg ist größer als 2 MB.',
    );
  });
});

describe("listExercises", () => {
  it("returns good exercises sorted and collects errors", async () => {
    await make("zeta");
    await make("alpha");
    await make("kaputt", { files: {} });
    await mkdir(path.join(tmp, "kein-exercise"));
    await writeFile(path.join(tmp, "datei.txt"), "x");
    const { exercises, errors } = await listExercises(tmp);
    expect(exercises.map((e) => e.id)).toEqual(["alpha", "zeta"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ExerciseError);
    expect(errors[0]!.message).toContain('Aufgabe "kaputt"');
  });

  it("lists the examples", async () => {
    const { exercises, errors } = await listExercises(examplesDir);
    expect(errors).toEqual([]);
    expect(exercises.map((e) => e.id)).toEqual(["maximum", "summe"]);
  });
});
