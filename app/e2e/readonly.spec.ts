import { expect, test } from "@playwright/test";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, setEditorText, useTempApp } from "./helpers";

useTempApp();

const HILFE = "class Hilfe {\n    static int doppelt(int x) {\n        return 2 * x;\n    }\n}\n";
const EXERCISE_YAML = `id: summe
title: "Summe zweier Zahlen"
files:
  - path: Summe.java
    editable: true
  - path: Hilfe.java
    editable: false
mainFile: Summe.java
`;

let exercisesDir: string;

test.beforeEach(() => {
  exercisesDir = mkdtempSync(join(tmpdir(), "jide-exercises-"));
  cpSync(join(examplesDir, "summe"), join(exercisesDir, "summe"), { recursive: true });
  writeFileSync(join(exercisesDir, "summe", "files", "Hilfe.java"), HILFE);
  writeFileSync(join(exercisesDir, "summe", "exercise.yaml"), EXERCISE_YAML);
});
test.afterEach(() => rmSync(exercisesDir, { recursive: true, force: true }));

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

test("a read-only file is marked, cannot be edited, is not copied to the workspace, but can be used", async () => {
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: exercisesDir });
  await openExercise(page, "Summe zweier Zahlen");

  const hilfeEntry = page.getByTestId("file-list").getByRole("button", { name: /Hilfe\.java/ });
  await expect(hilfeEntry).toContainText("nur lesen");
  await expect(page.getByTestId("file-list").getByRole("button", { name: /Summe\.java/ })).not.toContainText("nur lesen");

  // opening it and typing does not change the content
  await hilfeEntry.click();
  const lines = page.locator(".monaco-editor .view-lines");
  await expect(lines).toContainText("static int doppelt");
  const before = await lines.innerText();
  await lines.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("kaputt");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  expect(await lines.innerText()).toBe(before);
  await expect(lines).not.toContainText("kaputt");

  // the read-only file is never written to the workspace
  const userData = await app.evaluate(({ app: a }) => a.getPath("userData"));
  await expect.poll(() => existsSync(join(userData, "workspaces", "summe", "Summe.java"))).toBe(true);
  expect(filesUnder(join(userData, "workspaces"))).not.toContain("Hilfe.java");

  // Summe.java can use Hilfe.doppelt(...) and runs
  await page.getByTestId("file-list").getByRole("button", { name: /Summe\.java/ }).click();
  await setEditorText(app, page, "void main() {\n    IO.println(\"Doppelt: \" + Hilfe.doppelt(21));\n}\n");
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Doppelt: 42");
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("■ Programm beendet.");
  expect(filesUnder(join(userData, "workspaces"))).not.toContain("Hilfe.java");
});
