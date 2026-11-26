import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { expect, test, type ElectronApplication } from "@playwright/test";
import { examplesDir, launch, openExercise, setEditorText, useTempApp } from "./helpers";

useTempApp();

const SUMME = "Summe zweier Zahlen";
const MINE = `void main() {
    IO.println("mein eigener Code");
}
`;

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "jide-saveas-"));
  dirs.push(d);
  return d;
}
test.afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** The native dialogs cannot be driven: answer them. */
async function stubSaveDialog(app: ElectronApplication, path: string | undefined): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    (globalThis as { __saveDialogCalls?: number }).__saveDialogCalls = 0;
    dialog.showSaveDialog = (async () => {
      (globalThis as { __saveDialogCalls?: number }).__saveDialogCalls!++;
      return p === undefined ? { canceled: true, filePath: "" } : { canceled: false, filePath: p };
    }) as unknown as typeof dialog.showSaveDialog;
  }, path);
}
async function stubOpenDialog(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as unknown as typeof dialog.showOpenDialog;
  }, path);
}
/** Clicks Datei > Speichern unter… the way the menu does for the window that has the focus. */
async function clickMenuSaveAs(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById("save-as");
    const win = BrowserWindow.getAllWindows()[0];
    if (!item || !win) return false;
    item.click({}, win, win.webContents);
    return true;
  });
}

test("button: the open course exercise is saved as a ZIP that Importieren reads back with the student's code", async () => {
  const { app, page } = await launch();
  const target = join(tempDir(), "meine-summe.zip");
  await stubSaveDialog(app, target);

  await openExercise(page, SUMME);
  await setEditorText(app, page, MINE); // not saved yet: the button flushes first
  await page.getByTestId("save-as").click();
  await expect(page.getByTestId("save-as")).toHaveText("Speichern unter…");
  await expect.poll(() => existsSync(target)).toBe(true);

  const entries = unzipSync(new Uint8Array(readFileSync(target)));
  expect(Object.keys(entries).sort()).toEqual(["aufgabe.md", "exercise.yaml", "files/Summe.java", "tests.yaml"]);
  expect(strFromU8(entries["files/Summe.java"]!)).toBe(MINE);
  expect(strFromU8(entries["aufgabe.md"]!)).toBe(readFileSync(join(examplesDir, "summe", "aufgabe.md"), "utf8"));
  // the course exercise itself is untouched
  expect(readFileSync(join(examplesDir, "summe", "files", "Summe.java"), "utf8")).not.toBe(MINE);

  // back to the list, Scratch, import the ZIP: a new item with the code and the tests
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await stubOpenDialog(app, target);
  await page.getByTestId("scratch-import").click();
  await page.getByTestId("scratch-import-zip").click();
  const item = page.getByTestId("scratch-item").filter({ hasText: SUMME });
  await expect(item).toHaveCount(1);
  await expect(item.getByTestId("scratch-line")).toHaveText("Importiert · 3 Tests");
  await item.getByTestId("scratch-open").click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("mein eigener Code");
});

test("menu: Datei > Speichern unter… saves the open project; canceling the dialog writes nothing; without a workspace nothing happens", async () => {
  const { app, page } = await launch();
  const target = join(tempDir(), "menu.zip");
  await stubSaveDialog(app, undefined); // canceled

  // the exercise list is showing: no workspace, so the menu does nothing (no dialog)
  expect(await clickMenuSaveAs(app)).toBe(true);
  await page.waitForTimeout(300);
  expect(await app.evaluate(() => (globalThis as { __saveDialogCalls?: number }).__saveDialogCalls)).toBe(0);

  await openExercise(page, SUMME);
  await clickMenuSaveAs(app);
  await expect.poll(() => app.evaluate(() => (globalThis as { __saveDialogCalls?: number }).__saveDialogCalls)).toBe(1);
  expect(existsSync(target)).toBe(false);

  await stubSaveDialog(app, target);
  await setEditorText(app, page, MINE);
  await clickMenuSaveAs(app);
  await expect.poll(() => existsSync(target)).toBe(true);
  expect(strFromU8(unzipSync(new Uint8Array(readFileSync(target)))["files/Summe.java"]!)).toBe(MINE);
});

test("the menu item carries Ctrl/Cmd+Shift+S", async () => {
  const { app } = await launch();
  const accel = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("save-as")?.accelerator);
  expect(accel).toBe("CommandOrControl+Shift+S");
});

test("exam mode: no menu item, no button, and main refuses", async () => {
  const examDir = tempDir();
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  mkdirSync(join(examDir, "exercises"), { recursive: true });
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await stubSaveDialog(app, join(tempDir(), "x.zip"));
  await page.getByLabel("Vor- und Nachname").fill("Max Muster");
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
  await expect(page.locator(".monaco-editor .view-lines:visible")).toBeVisible();

  await expect(page.getByTestId("save-as")).toHaveCount(0);
  expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("save-as") ?? null)).toBeNull();
  const r = await page.evaluate(() => (window as unknown as { jide: { saveProjectAs: (id: string) => Promise<unknown> } }).jide.saveProjectAs("summe"));
  expect(r).toEqual({ ok: false, message: "Speichern unter gibt es in der Prüfung nicht." });
  expect(await app.evaluate(() => (globalThis as { __saveDialogCalls?: number }).__saveDialogCalls)).toBe(0);
});
