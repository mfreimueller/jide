import { expect, test, type ElectronApplication, type Locator, type Page } from "@playwright/test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, useTempApp } from "./helpers";

useTempApp();

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#cde"/></svg>`;
const dirs: string[] = [];
test.afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const click = (app: ElectronApplication, id: string) =>
  app.evaluate(({ Menu, BrowserWindow }, i) => {
    const win = BrowserWindow.getAllWindows()[0];
    Menu.getApplicationMenu()!.getMenuItemById(i)!.click(undefined, win, win.webContents);
  }, id);
const zoomLevel = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomLevel());
const fontOf = (lines: Locator) => () => lines.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

/** Ctrl + wheel over `target` (a real wheel through Playwright). */
async function ctrlWheel(page: Page, target: Locator, dy: number): Promise<void> {
  await target.hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, dy);
  await page.keyboard.up("Control");
  await page.waitForTimeout(300);
}

test("Ansicht > Editor-Schrift changes only the editor font, within 10 to 28 px", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  const font = fontOf(page.locator(".monaco-editor .view-lines:visible"));
  await expect.poll(font).toBe(14);
  await click(app, "editor-font-in");
  await expect.poll(font).toBe(15);
  await click(app, "editor-font-in-alt");
  await expect.poll(font).toBe(16);
  await click(app, "editor-font-out");
  await expect.poll(font).toBe(15);
  for (let i = 0; i < 20; i++) await click(app, "editor-font-in");
  await expect.poll(font).toBe(28);
  for (let i = 0; i < 20; i++) await click(app, "editor-font-out");
  await expect.poll(font).toBe(10);
  await click(app, "editor-font-reset");
  await expect.poll(font).toBe(14);
  expect(await zoomLevel(app)).toBe(0);
});

test("Ctrl + wheel neither zooms the app nor changes the editor font", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  const editor = page.locator(".monaco-editor .view-lines:visible");
  const font = fontOf(editor);
  await ctrlWheel(page, editor, -200);
  await ctrlWheel(page, editor, 200);
  await ctrlWheel(page, page.getByTestId("assignment"), -200);
  await ctrlWheel(page, page.getByTestId("assignment"), 200);
  expect(await zoomLevel(app)).toBe(0);
  expect(await font()).toBe(14);
});

test("over the diagram viewer Ctrl + wheel zooms only the diagram", async () => {
  const root = mkdtempSync(join(tmpdir(), "jide-wzoom-"));
  dirs.push(root);
  cpSync(join(examplesDir, "summe"), join(root, "summe"), { recursive: true });
  writeFileSync(join(root, "summe", "files", "d.svg"), SVG);
  writeFileSync(
    join(root, "summe", "exercise.yaml"),
    `id: summe\ntitle: "Summe zweier Zahlen"\nfiles:\n  - path: Summe.java\nmainFile: Summe.java\nimages:\n  - path: d.svg\n`
  );
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: root });
  await openExercise(page, "Summe zweier Zahlen");
  const font = fontOf(page.locator(".monaco-editor .view-lines"));
  await page.getByTestId("file-list").getByTestId("image-file").first().click();
  await expect(page.getByTestId("image-viewer")).toBeVisible();
  const percent = page.getByTestId("zoom-level");
  await page.getByTestId("zoom-100").click();
  await expect(percent).toHaveText("100 %");
  const img = page.getByTestId("image-viewer-img");
  await ctrlWheel(page, img, -200);
  await expect.poll(async () => parseInt((await percent.textContent())!, 10)).toBeGreaterThan(100);
  await ctrlWheel(page, img, 400);
  await expect.poll(async () => parseInt((await percent.textContent())!, 10)).toBeLessThan(100);
  expect(await zoomLevel(app)).toBe(0);
  expect(await font()).toBe(14);
});

test("exam mode: Ctrl + wheel does not zoom, the menu changes the editor font", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  dirs.push(examDir);
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await page.getByLabel("Vor- und Nachname").fill("Max Muster");
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
  const editor = page.locator(".monaco-editor .view-lines:visible");
  await expect(editor).toBeVisible();
  const font = fontOf(editor);
  await ctrlWheel(page, editor, -200);
  expect(await zoomLevel(app)).toBe(0);
  expect(await font()).toBe(14);
  await click(app, "editor-font-in");
  await expect.poll(font).toBe(15);
});
