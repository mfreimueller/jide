import { expect, test, type ElectronApplication, type Locator, type Page } from "@playwright/test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ZOOM_LEVEL_MAX, ZOOM_LEVEL_MIN } from "../src/main/zoom-level";
import { examplesDir, launch, openExercise, useTempApp, userDataDir } from "./helpers";

useTempApp();

const SHOT = process.env.WHEEL_ZOOM_SCREENSHOT;
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#cde"/></svg>`;

const level = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomLevel());

/** Ctrl (or Cmd) + wheel over `target`; dy < 0 = wheel up. */
async function wheel(page: Page, target: Locator, dy: number, key = "Control"): Promise<void> {
  await target.hover();
  await page.keyboard.down(key);
  await page.mouse.wheel(0, dy);
  await page.keyboard.up(key);
}

/**
 * A real wheel through Playwright: the delta it produces varies (about 170 to 200 for 100 on a retina
 * Mac), so the number of steps is not fixed. Checks the direction only; exact steps are tested with
 * synthetic events below.
 */
async function zoomed(app: ElectronApplication, page: Page, target: Locator, dy: number, key = "Control"): Promise<number> {
  const before = await level(app);
  // a single wheel can come out below one step (the delta varies), so ask again after a pause
  for (let i = 0; i < 3 && (await level(app)) === before; i++) {
    await wheel(page, target, dy, key);
    await page.waitForTimeout(400);
  }
  await expect.poll(() => level(app)).not.toBe(before);
  const after = await level(app);
  if (dy < 0) expect(after).toBeGreaterThan(before);
  else expect(after).toBeLessThan(before);
  return after;
}

const dirs: string[] = [];
test.afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("Ctrl + wheel over the editor and the Angabe zooms the app, both directions", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  expect(await level(app)).toBe(0);

  const editor = page.locator(".monaco-editor .view-lines:visible");
  // down first: the maximum is only 120 %, so there is little room upwards
  await zoomed(app, page, editor, 100);
  await zoomed(app, page, editor, 100);
  await zoomed(app, page, editor, -100);

  const assignment = page.getByTestId("assignment");
  await zoomed(app, page, assignment, -100);
  await zoomed(app, page, assignment, 100);

  // Cmd + wheel (macOS) too; a plain wheel does not zoom
  const two = await zoomed(app, page, editor, -100, "Meta");
  await editor.hover();
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(300);
  expect(await level(app)).toBe(two);
});

test("one wheel notch is one menu-sized step (Ansicht > Zoom In / Zoom Out)", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  const editor = page.locator(".monaco-editor .view-lines:visible");
  const notch = (deltaY: number, deltaMode = 0, key: "ctrlKey" | "metaKey" = "ctrlKey") =>
    editor.evaluate(
      (el, a) =>
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: a.deltaY, deltaMode: a.deltaMode, [a.key]: true, bubbles: true, cancelable: true })),
      { deltaY, deltaMode, key }
    );
  const menu = (id: "zoom-in" | "zoom-out" | "zoom-reset") =>
    app.evaluate(({ Menu, BrowserWindow }, i) => {
      const item = Menu.getApplicationMenu()!.getMenuItemById(i)!;
      const win = BrowserWindow.getAllWindows()[0];
      item.click(undefined, win, win.webContents);
    }, id);

  await notch(-100);
  await expect.poll(() => level(app)).toBe(0.5);
  await notch(-3, 1, "metaKey"); // deltaMode LINE: 3 lines
  await expect.poll(() => level(app)).toBe(ZOOM_LEVEL_MAX);
  await menu("zoom-out");
  await expect.poll(() => level(app)).toBe(0.5);
  await menu("zoom-in");
  await expect.poll(() => level(app)).toBe(1);
  await notch(100);
  await expect.poll(() => level(app)).toBe(0.5);
  await menu("zoom-reset");
  await expect.poll(() => level(app)).toBe(0);
  // trackpad: ten small deltas make one step
  for (let i = 0; i < 10; i++) await notch(-10);
  await expect.poll(() => level(app)).toBe(0.5);
});

test("menu and wheel share the limits: Zoom In stops at 120 %, Zoom Out at 76 %", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  const click = (id: string) =>
    app.evaluate(({ Menu, BrowserWindow }, i) => {
      const win = BrowserWindow.getAllWindows()[0];
      Menu.getApplicationMenu()!.getMenuItemById(i)!.click(undefined, win, win.webContents);
    }, id);
  for (let i = 0; i < 6; i++) await click("zoom-in");
  await expect.poll(() => level(app)).toBe(ZOOM_LEVEL_MAX);
  await wheel(page, page.locator(".monaco-editor .view-lines:visible"), -100);
  await page.waitForTimeout(300);
  expect(await level(app)).toBe(ZOOM_LEVEL_MAX);
  await click("zoom-reset");
  await expect.poll(() => level(app)).toBe(0);
  for (let i = 0; i < 8; i++) await click("zoom-out");
  await expect.poll(() => level(app)).toBe(ZOOM_LEVEL_MIN);
  await wheel(page, page.getByTestId("assignment"), 100);
  await page.waitForTimeout(300);
  expect(await level(app)).toBe(ZOOM_LEVEL_MIN);
});

test("the zoom is limited and the editor stays visible at the largest size in a small window", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await page.setViewportSize({ width: 1024, height: 700 });
  const editor = page.locator(".monaco-editor .view-lines:visible");
  for (let i = 0; i < 8; i++) await wheel(page, editor, -100);
  await expect.poll(() => level(app)).toBe(ZOOM_LEVEL_MAX);
  await wheel(page, editor, -100);
  await page.waitForTimeout(300);
  expect(await level(app)).toBe(ZOOM_LEVEL_MAX);
  if (SHOT) await page.screenshot({ path: SHOT });
  const box = (await page.locator(".monaco-editor:visible").first().boundingBox())!;
  expect(box.width).toBeGreaterThan(150);
  expect(box.height).toBeGreaterThan(80);
  for (let i = 0; i < 20; i++) await wheel(page, page.getByTestId("assignment"), 100);
  await expect.poll(() => level(app)).toBe(ZOOM_LEVEL_MIN);
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
  await page.getByTestId("file-list").getByTestId("image-file").first().click();
  await expect(page.getByTestId("image-viewer")).toBeVisible();
  const percent = page.getByTestId("zoom-level");
  await page.getByTestId("zoom-100").click();
  await expect(percent).toHaveText("100 %");

  await wheel(page, page.getByTestId("image-viewer-img"), -200);
  await expect.poll(async () => parseInt((await percent.textContent())!, 10)).toBeGreaterThan(100);
  expect(await level(app)).toBe(0);
  await wheel(page, page.getByTestId("image-viewer-img"), 400);
  await expect.poll(async () => parseInt((await percent.textContent())!, 10)).toBeLessThan(100);
  expect(await level(app)).toBe(0);

  // outside the viewer (Angabe) the app zooms and the diagram stays as it is
  const before = await percent.textContent();
  await zoomed(app, page, page.getByTestId("assignment"), -100);
  await expect(percent).toHaveText(before!);
});

test("the zoom is not remembered: 100 % after a restart", async () => {
  const first = await launch();
  await openExercise(first.page, "Summe zweier Zahlen");
  const editor = first.page.locator(".monaco-editor .view-lines:visible");
  await zoomed(first.app, first.page, editor, -100);
  await first.app.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
  await first.app.close().catch(() => undefined);

  const second = await launch({}, userDataDir());
  await expect(second.page.getByTestId("exercise").first()).toBeVisible();
  expect(await level(second.app)).toBe(0);
});

test("exam mode: Ctrl + wheel zooms there as well", async () => {
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
  await zoomed(app, page, editor, -100);
  await zoomed(app, page, editor, 100);
});
