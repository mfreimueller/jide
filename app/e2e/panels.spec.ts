import { expect, test, type Page } from "@playwright/test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, useTempApp } from "./helpers";

useTempApp();

const SCREENSHOTS = process.env.PANEL_SCREENSHOTS;

const files = (p: Page) => p.locator('[data-testid="file-list"]');
const assign = (p: Page) => p.locator('[data-testid="assignment"]');
const bottom = (p: Page) => p.locator(".bottom");
const width = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!.width;
const height = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!.height;

async function focusEditor(page: Page): Promise<void> {
  await page.locator(".monaco-editor .view-lines:visible").click();
  await expect(page.locator(".monaco-editor.focused:visible")).toBeVisible();
}

/** Drags the handle by (dx, dy) pixels from its middle. */
async function drag(page: Page, testid: string, dx: number, dy: number): Promise<void> {
  const box = (await page.getByTestId(testid).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + (box.height === 0 ? 0 : box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
  await page.mouse.move(x + dx, y + dy, { steps: 3 });
  await page.mouse.up();
}

async function expectCollapsed(page: Page, panel: "files" | "assign" | "bottom", collapsed: boolean): Promise<void> {
  if (panel === "files") {
    await expect(files(page)).toBeVisible({ visible: !collapsed });
    await expect(page.getByTestId("files-strip")).toBeVisible({ visible: collapsed });
  } else if (panel === "assign") {
    await expect(assign(page)).toBeVisible({ visible: !collapsed });
    await expect(page.getByTestId("assign-strip")).toBeVisible({ visible: collapsed });
  } else {
    await expect(page.locator(".bottom .body")).toBeVisible({ visible: !collapsed });
    await expect(page.getByTestId("bottom-toggle")).toHaveAttribute("aria-label", collapsed ? "Ausgabe aufklappen (Alt+3)" : "Ausgabe einklappen (Alt+3)");
  }
  // the editor always takes the freed room and keeps a usable size
  const editor = (await page.locator(".monaco-editor:visible").first().boundingBox())!;
  expect(editor.width).toBeGreaterThan(300);
  expect(editor.height).toBeGreaterThan(150);
}

test("each panel collapses and reopens by button, tooltips and strips", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");

  // Dateien
  const defaultFiles = await width(files(page));
  expect(defaultFiles).toBe(210);
  await page.getByTestId("files-collapse").hover();
  await expect(page.getByTestId("files-collapse")).toHaveAttribute("data-tip", "Dateien einklappen (Alt+1)");
  await page.getByTestId("files-collapse").click();
  await expectCollapsed(page, "files", true);
  expect(await width(page.getByTestId("files-strip"))).toBe(32);
  await expect(page.getByTestId("files-expand")).toHaveAttribute("data-tip", "Dateien aufklappen (Alt+1)");
  await page.getByTestId("files-expand").click();
  await expectCollapsed(page, "files", false);
  expect(await width(files(page))).toBe(defaultFiles);

  // Angabe
  expect(await width(assign(page))).toBe(330);
  await expect(assign(page).getByText("Angabe", { exact: true })).toBeVisible();
  await expect(page.getByTestId("assign-collapse")).toHaveAttribute("data-tip", "Angabe einklappen (Alt+2)");
  await page.getByTestId("assign-collapse").click();
  await expectCollapsed(page, "assign", true);
  expect(await width(page.getByTestId("assign-strip"))).toBe(32);
  await expect(page.getByTestId("assign-expand")).toHaveAttribute("data-tip", "Angabe aufklappen (Alt+2)");
  await page.getByTestId("assign-expand").click();
  await expectCollapsed(page, "assign", false);
  expect(await width(assign(page))).toBe(330);

  // bottom panel: only the tab bar stays, no "Leeren"
  expect(await height(bottom(page))).toBe(230);
  await expect(page.getByTestId("clear-console")).toBeVisible();
  await page.getByTestId("bottom-toggle").click();
  await expectCollapsed(page, "bottom", true);
  expect(await height(bottom(page))).toBe(37);
  await expect(page.getByTestId("clear-console")).toHaveCount(0);
  await expect(page.getByTestId("btab-Konsole")).toBeVisible();
  await page.getByTestId("bottom-toggle").click();
  await expectCollapsed(page, "bottom", false);
  expect(await height(bottom(page))).toBe(230);
});

test("clicking a tab of the collapsed bottom panel reopens it on that tab", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await page.getByTestId("bottom-toggle").click();
  await expectCollapsed(page, "bottom", true);
  await page.getByTestId("btab-Probleme").click();
  await expectCollapsed(page, "bottom", false);
  await expect(page.getByTestId("problems")).toBeVisible();
  // collapsing keeps the chosen tab
  await page.getByTestId("bottom-toggle").click();
  await page.getByTestId("btab-Konsole").click();
  await expect(page.getByTestId("bottom-Konsole")).toBeVisible();
  await expect(page.getByTestId("clear-console")).toBeVisible();
});

test("Alt+1, Alt+2, Alt+3 toggle the panels, also with the focus in the editor and the console", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");

  await focusEditor(page);
    const before = await page.locator(".monaco-editor .view-lines:visible").innerText();
  for (const [key, panel] of [["Digit1", "files"], ["Digit2", "assign"], ["Digit3", "bottom"]] as const) {
    await page.keyboard.press(`Alt+${key}`);
    await expectCollapsed(page, panel, true);
    await expect(page.locator(".monaco-editor.focused")).toBeVisible(); // the focus stays in the editor
    await page.keyboard.press(`Alt+${key}`);
    await expectCollapsed(page, panel, false);
  }
  // nothing was typed into the editor (macOS would type ¡ ™ £)
  expect(await page.locator(".monaco-editor .view-lines:visible").innerText()).toBe(before);

  // focus in the console (xterm)
  await page.locator(".xterm:visible").click();
  await expect(page.locator(".xterm-helper-textarea")).toBeFocused();
  for (const [key, panel] of [["Digit1", "files"], ["Digit2", "assign"]] as const) {
    await page.keyboard.press(`Alt+${key}`);
    await expectCollapsed(page, panel, true);
    await page.keyboard.press(`Alt+${key}`);
    await expectCollapsed(page, panel, false);
  }
  // Alt+3 from the console collapses the bottom panel, Alt+3 again reopens it
  await page.keyboard.press("Alt+Digit3");
  await expectCollapsed(page, "bottom", true);
  await page.keyboard.press("Alt+Digit3");
  await expectCollapsed(page, "bottom", false);
});

test("resize by dragging: side panels and the bottom panel, within their limits", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");

  await drag(page, "files-handle", 100, 0);
  expect(await width(files(page))).toBe(310);
  await drag(page, "files-handle", -1000, 0);
  expect(await width(files(page))).toBe(160); // minimum
  await drag(page, "files-handle", 2000, 0);
  // maximum: the editor keeps 300px next to the 330px Angabe
  expect(await width(files(page))).toBe(1280 - 330 - 300);
  await drag(page, "files-handle", -600, 0);
  expect(await width(files(page))).toBe(160);

  await drag(page, "assign-handle", -100, 0);
  expect(await width(assign(page))).toBe(430);
  await drag(page, "assign-handle", 1000, 0);
  expect(await width(assign(page))).toBe(160);
  await drag(page, "assign-handle", -2000, 0);
  expect(await width(assign(page))).toBe(1280 - 160 - 300);
  await drag(page, "assign-handle", 2000, 0);

  await drag(page, "bottom-handle", 0, -100);
  expect(await height(bottom(page))).toBe(330);
  await drag(page, "bottom-handle", 0, 1000);
  expect(await height(bottom(page))).toBe(140); // minimum
  await drag(page, "bottom-handle", 0, -2000);
  const editor = (await page.locator(".monaco-editor:visible").first().boundingBox())!;
  expect(editor.height).toBeGreaterThanOrEqual(149); // the editor keeps 150px

  // Monaco and the console follow the size: the editor fills its column, the terminal has rows
  await drag(page, "bottom-handle", 0, 2000);
  await expect.poll(async () => (await page.locator(".monaco-editor:visible").first().boundingBox())!.height).toBeGreaterThan(400);
  await expect(page.locator(".xterm-rows:visible")).toBeVisible();
  expect((await page.locator(".xterm-screen:visible").boundingBox())!.height).toBeGreaterThan(50);
});

test("the layout is shared: it survives opening another exercise", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await page.getByTestId("files-collapse").click();
  await drag(page, "assign-handle", -80, 0);
  await page.getByTestId("bottom-toggle").click();
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await openExercise(page, "Größere Zahl");
  await expectCollapsed(page, "files", true);
  await expectCollapsed(page, "bottom", true);
  expect(await width(assign(page))).toBe(410);
  await page.keyboard.press("Alt+Digit1");
  await expectCollapsed(page, "files", false);
});

test("a fresh start has the default layout", async () => {
  const first = await launch();
  await openExercise(first.page, "Summe zweier Zahlen");
  await first.page.getByTestId("files-collapse").click();
  await first.app.evaluate(({ app }) => app.exit(0)).catch(() => undefined);
  const second = await launch();
  await openExercise(second.page, "Summe zweier Zahlen");
  await expectCollapsed(second.page, "files", false);
});

test("screenshots: expanded and all collapsed", async () => {
  test.skip(!SCREENSHOTS, "set PANEL_SCREENSHOTS=<dir> to write them");
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await page.getByTestId("files-collapse").hover();
  await page.screenshot({ path: join(SCREENSHOTS!, "panels-expanded.png") });
  await page.keyboard.press("Alt+Digit1");
  await page.keyboard.press("Alt+Digit2");
  await page.keyboard.press("Alt+Digit3");
  await page.mouse.move(600, 300);
  await page.screenshot({ path: join(SCREENSHOTS!, "panels-collapsed.png") });
});

test.describe("exam mode", () => {
  let examDir: string;
  test.beforeEach(() => {
    examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
    writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
    cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
    cpSync(join(examplesDir, "maximum"), join(examDir, "exercises", "maximum"), { recursive: true });
  });
  test.afterEach(() => rmSync(examDir, { recursive: true, force: true }));

  const vis = (p: Page, id: string) => p.locator(`[data-testid="${id}"]:visible`);

  test("collapse, resize and shortcuts work; one shortcut toggles once; the layout is shared by all tabs", async () => {
    const { page } = await launch({ JIDE_EXAM_DIR: examDir });
    await page.getByLabel("Vor- und Nachname").fill("Max Muster");
    await page.getByRole("button", { name: "Prüfung starten" }).click();
    await expect(vis(page, "exam-tabs")).toBeVisible();
    const tabs = page.locator('[data-testid="exam-tab"]:visible');
    await expect(page.locator(".monaco-editor .view-lines:visible")).toBeVisible();
    // mount the second workspace as well, then come back
    await tabs.nth(1).click();
    await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText(/Aufgabe 2/);
    await tabs.nth(0).click();
    await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText(/Aufgabe 1/);
    await expect(page.locator('[data-testid="file-list"]')).toHaveCount(2); // two workspaces mounted

    // by button
    await vis(page, "files-collapse").click();
    await expect(vis(page, "files-strip")).toBeVisible();
    await vis(page, "files-expand").click();
    await expect(vis(page, "file-list")).toBeVisible();

    // by shortcut, once per key press, with the focus in the editor
    await page.locator(".monaco-editor .view-lines:visible").click();
    await page.keyboard.press("Alt+Digit1");
    await expect(vis(page, "files-strip")).toBeVisible();
    await page.keyboard.press("Alt+Digit2");
    await expect(vis(page, "assign-strip")).toBeVisible();
    await page.keyboard.press("Alt+Digit3");
    await expect(vis(page, "bottom-toggle")).toHaveAttribute("aria-label", "Ausgabe aufklappen (Alt+3)");

    // the other tab shows the same layout
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(vis(page, "files-strip")).toBeVisible();
    await expect(vis(page, "assign-strip")).toBeVisible();
    await expect(vis(page, "bottom-toggle")).toHaveAttribute("aria-label", "Ausgabe aufklappen (Alt+3)");
    await page.keyboard.press("Alt+Digit1");
    await expect(vis(page, "file-list")).toBeVisible();
    await page.keyboard.press("Alt+Digit2");
    await page.keyboard.press("Alt+Digit3");
    await expect(vis(page, "assignment")).toBeVisible();
    await expect(vis(page, "bottom-Konsole")).toBeVisible();

    // resize here, see it in the first tab
    const box = (await page.locator('.slot:not(.hidden) [data-testid="files-handle"]').boundingBox())!;
    await page.mouse.move(box.x, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 100, { steps: 4 });
    await page.mouse.up();
    expect((await vis(page, "file-list").boundingBox())!.width).toBe(270);
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute("aria-pressed", "true");
    expect((await vis(page, "file-list").boundingBox())!.width).toBe(270);
  });
});
