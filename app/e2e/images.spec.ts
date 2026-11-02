import { expect, test } from "@playwright/test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, setEditorText, useTempApp } from "./helpers";

useTempApp();

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#cde"/><text x="20" y="40">Klassendiagramm</text></svg>`;
const YAML = `id: summe
title: "Summe zweier Zahlen"
files:
  - path: Summe.java
mainFile: Summe.java
images:
  - path: diagramm.svg
    title: Flussdiagramm
  - path: ohne-titel.svg
`;

let root: string;
test.beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "jide-images-"));
});
const extra: string[] = [];
test.afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  for (const d of extra.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** summe, with the two SVGs when `withImages`. */
function makeExercise(dir: string, withImages: boolean): void {
  cpSync(join(examplesDir, "summe"), join(dir, "summe"), { recursive: true });
  if (!withImages) return;
  writeFileSync(join(dir, "summe", "files", "diagramm.svg"), SVG);
  writeFileSync(join(dir, "summe", "files", "ohne-titel.svg"), SVG);
  writeFileSync(join(dir, "summe", "exercise.yaml"), YAML);
}

test("an image opens in a viewer, zoom works, the Java tab is intact afterwards", async () => {
  makeExercise(root, true);
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: root });
  await openExercise(page, "Summe zweier Zahlen");

  const list = page.getByTestId("file-list");
  await expect(list.locator("button.file")).toHaveText([/Summe\.java/, /Flussdiagramm/, /ohne-titel\.svg/]);
  await expect(page.getByTestId("image-viewer")).toHaveCount(0);

  const text = "void main() {\n    IO.println(\"Bild\");\n}\n";
  await setEditorText(app, page, text);

  await list.getByTestId("image-file").first().click();
  await expect(page.getByTestId("image-viewer")).toBeVisible();
  await expect(page.getByTestId("tabs").getByRole("button")).toHaveText(["Summe.java", "Flussdiagramm"]);
  await expect(page.getByTestId("image-viewer")).toContainText("diagramm.svg · nur lesen");
  await expect(page.getByTestId("image-viewer")).toContainText("Strg + Mausrad zoomt");
  await expect(page.locator(".monaco-editor")).toBeHidden();
  await expect(page.getByTestId("image-viewer-img")).toHaveAttribute("src", /^data:image\/svg\+xml/);

  // fit mode: whole image visible, below 100 %
  const level = page.getByTestId("zoom-level");
  await expect(page.getByTestId("zoom-fit")).toHaveClass(/active/);
  await expect(level).toHaveText(/^\d+ %$/);
  const fitted = parseInt((await level.textContent())!, 10);
  expect(fitted).toBeLessThan(100);

  await page.getByTestId("zoom-100").click();
  await expect(level).toHaveText("100 %");
  await expect(page.getByTestId("zoom-fit")).not.toHaveClass(/active/);
  await page.getByTestId("zoom-in").click();
  await expect(level).toHaveText("125 %");
  await page.getByTestId("zoom-out").click();
  await page.getByTestId("zoom-out").click();
  await expect(level).toHaveText("90 %");
  // Ctrl + wheel zooms (up = larger)
  await page.getByTestId("image-viewer-img").hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  await expect.poll(async () => parseInt((await level.textContent())!, 10)).toBeGreaterThan(90);
  await page.getByTestId("zoom-fit").click();
  await expect(level).toHaveText(`${fitted} %`);

  // back to the Java file: editor visible, text intact
  await page.getByTestId("tabs").getByRole("button", { name: "Summe.java" }).click();
  await expect(page.getByTestId("image-viewer")).toHaveCount(0);
  await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText("IO.println");
  await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText("Bild");

  // Run still works with an image tab open; the image is not a workspace file
  await list.getByTestId("image-file").nth(1).click();
  await expect(page.getByTestId("image-viewer")).toContainText("ohne-titel.svg");
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Bild");
});

test("an exercise without images has no image rows and no viewer", async () => {
  makeExercise(root, false);
  const { page } = await launch({ JIDE_EXERCISES_DIR: root });
  await openExercise(page, "Summe zweier Zahlen");
  await expect(page.getByTestId("file-list").locator("button.file")).toHaveText([/Summe\.java/]);
  await expect(page.getByTestId("image-file")).toHaveCount(0);
  await expect(page.getByTestId("image-viewer")).toHaveCount(0);
  await expect(page.locator(".monaco-editor .view-lines")).toBeVisible();
});

test("exam mode: the image opens in the viewer too", async () => {
  const exam = mkdtempSync(join(tmpdir(), "jide-exam-img-"));
  extra.push(exam);
  writeFileSync(join(exam, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  makeExercise(join(exam, "exercises"), true);
  const { page } = await launch({ JIDE_EXAM_DIR: exam });
  await page.getByLabel("Vor- und Nachname").fill("Max Muster");
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
  const list = page.locator('[data-testid="file-list"]:visible');
  await list.getByTestId("image-file").first().click();
  await expect(page.locator('[data-testid="image-viewer"]:visible')).toBeVisible();
  await page.locator('[data-testid="tabs"]:visible').getByRole("button", { name: "Summe.java" }).click();
  await expect(page.locator(".monaco-editor .view-lines:visible")).toBeVisible();
});
