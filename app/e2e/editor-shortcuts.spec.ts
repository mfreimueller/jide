import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

const appDir = resolve(__dirname, "..");
const examplesDir = resolve(appDir, "..", "examples");

let userData: string;
const running: ElectronApplication[] = [];

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), "jide-e2e-"));
});

test.afterEach(async () => {
  for (const app of running.splice(0)) await app.close().catch(() => undefined);
  rmSync(userData, { recursive: true, force: true });
});

/** Opens an exercise, types `text` on a new last line and returns the page. */
async function openWithNewLine(text: string): Promise<Page> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, JIDE_USER_DATA_DIR: userData, JIDE_EXERCISES_DIR: examplesDir }
  });
  running.push(app);
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("exercise").filter({ hasText: "Größere Zahl" }).getByRole("button", { name: "Öffnen" }).click();
  const lines = page.locator(".monaco-editor .view-lines");
  await expect(lines).toContainText(/\S/);
  await lines.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(`\n${text}`);
  await page.keyboard.press("Escape"); // close a possible suggest widget
  return page;
}

const MAC = process.platform === "darwin";
const WORD = MAC ? "Alt" : "Control";

for (const [name, chord] of [
  ["Ctrl+/", "ControlOrMeta+/"],
  // "/" is Shift+7 on a German keyboard; the test sends the physical Digit7 key with Shift
  ["Ctrl+Shift+7", "ControlOrMeta+Shift+Digit7"]
] as const) {
  test(`${name} comments and uncomments the current line`, async () => {
    const page = await openWithNewLine("int marker = 1;");
    const lines = page.locator(".monaco-editor .view-lines");
    await expect(lines).toContainText("int marker = 1;");
    await expect(lines).not.toContainText("// int marker = 1;");
    await page.keyboard.press(chord);
    await expect(lines).toContainText("// int marker = 1;");
    await page.keyboard.press(chord);
    await expect(lines).toContainText("int marker = 1;");
    await expect(lines).not.toContainText("// int marker = 1;");
  });
}

test("word jump moves the cursor by a word", async () => {
  const page = await openWithNewLine("alpha beta gamma");
  const lines = page.locator(".monaco-editor .view-lines");
  await page.keyboard.press("Home");
  await page.keyboard.press(`${WORD}+ArrowRight`);
  await page.keyboard.type("X");
  await expect(lines).toContainText("alphaX beta gamma");
  await page.keyboard.press(`${WORD}+ArrowRight`);
  await page.keyboard.type("Y");
  await expect(lines).toContainText("alphaX betaY gamma");
  await page.keyboard.press(`${WORD}+ArrowLeft`);
  await page.keyboard.type("Z");
  await expect(lines).toContainText("alphaX ZbetaY gamma");
});

test("sout expands to System.out.println();", async () => {
  const page = await openWithNewLine("");
  const lines = page.locator(".monaco-editor .view-lines");
  await page.keyboard.type("sout");
  await expect(page.locator(".suggest-widget")).toBeVisible();
  await expect(page.locator(".suggest-widget .monaco-list-row.focused")).toContainText("sout");
  await page.keyboard.press("Enter");
  await expect(lines).toContainText("System.out.println();");
});
