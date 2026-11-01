import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

export const appDir = resolve(__dirname, "..");
export const examplesDir = resolve(appDir, "..", "examples");
export const screenshotDir = join(appDir, "e2e", "screenshots");

let userData: string;
const running: ElectronApplication[] = [];

/** Registers the per-test temp user data folder and app cleanup. Call once per spec file. */
export function useTempApp(): void {
  test.beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), "jide-e2e-"));
    mkdirSync(screenshotDir, { recursive: true });
  });
  test.afterEach(async () => {
    for (const app of running.splice(0)) await app.close().catch(() => undefined);
    rmSync(userData, { recursive: true, force: true });
    for (const d of extraDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
}

/** Another empty user data folder (a second laptop), removed after the test. */
export function newUserData(): string {
  const dir = mkdtempSync(join(tmpdir(), "jide-e2e-"));
  extraDirs.push(dir);
  return dir;
}
const extraDirs: string[] = [];

/** `userDataDir` defaults to the test's own folder. An empty JIDE_EXERCISES_DIR switches to online mode. */
export async function launch(
  extraEnv: Record<string, string> = {},
  userDataDir?: string
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, JIDE_USER_DATA_DIR: userDataDir ?? userData, JIDE_EXERCISES_DIR: examplesDir, ...extraEnv }
  });
  running.push(app);
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  return { app, page };
}

export function userDataDir(): string {
  return userData;
}

export function card(page: Page, title: string) {
  return page.getByTestId("exercise").filter({ hasText: title });
}

export async function openExercise(page: Page, title: string): Promise<void> {
  await card(page, title)
    .getByRole("button", { name: /Öffnen|Weiterarbeiten|Ansehen/ })
    .click();
  await expect(page.locator(".monaco-editor .view-lines")).toBeVisible();
}

/** Replaces the whole content of the active editor with `text`. */
export async function setEditorText(app: ElectronApplication, page: Page, text: string): Promise<void> {
  await page.locator(".monaco-editor .view-lines:visible").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  // Monaco auto-closes brackets/quotes and auto-indents when typing; paste instead.
  await app.evaluate(({ clipboard }, t) => clipboard.writeText(t), text);
  await page.keyboard.press("ControlOrMeta+V");
}
