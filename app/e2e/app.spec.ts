import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";

const appDir = resolve(__dirname, "..");
const examplesDir = resolve(appDir, "..", "examples");
const screenshotDir = join(appDir, "e2e", "screenshots");

let userData: string;
const running: ElectronApplication[] = [];

test.beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), "jide-e2e-"));
  mkdirSync(screenshotDir, { recursive: true });
});

test.afterEach(async () => {
  for (const app of running.splice(0)) await app.close().catch(() => undefined);
  rmSync(userData, { recursive: true, force: true });
});

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, JIDE_USER_DATA_DIR: userData, JIDE_EXERCISES_DIR: examplesDir }
  });
  running.push(app);
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  return { app, page };
}

function card(page: Page, title: string) {
  return page.getByTestId("exercise").filter({ hasText: title });
}

test("list shows both examples as Neu", async () => {
  const { page } = await launch();
  await expect(card(page, "Größere Zahl")).toContainText("Neu");
  await expect(card(page, "Summe zweier Zahlen")).toContainText("Neu");
  await page.screenshot({ path: join(screenshotDir, "list.png") });
});

test("opening an exercise shows code and rendered assignment", async () => {
  const { page } = await launch();
  await card(page, "Summe zweier Zahlen").getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(/void\s*main/);
  const assignment = page.getByTestId("assignment");
  await expect(assignment.getByRole("heading", { name: "Summe zweier Zahlen" })).toBeVisible();
  await expect(assignment.locator("code", { hasText: "Scanner" }).first()).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText("Gespeichert");
  await page.screenshot({ path: join(screenshotDir, "workspace.png") });
});

test("edits survive a restart", async () => {
  const first = await launch();
  await card(first.page, "Summe zweier Zahlen").getByRole("button", { name: "Öffnen" }).click();
  await first.page.locator(".monaco-editor .view-lines").click();
  await first.page.keyboard.press("ControlOrMeta+End");
  await first.page.keyboard.type("// hallo-neustart");
  await expect(first.page.getByTestId("save-status")).toHaveText("Gespeichert");
  await first.app.close();

  const second = await launch();
  await expect(card(second.page, "Summe zweier Zahlen")).toContainText("In Arbeit");
  await expect(card(second.page, "Größere Zahl")).toContainText("Neu");
  await card(second.page, "Summe zweier Zahlen").getByRole("button", { name: "Weiterarbeiten" }).click();
  await expect(second.page.locator(".monaco-editor .view-lines")).toContainText("hallo-neustart");
});

test("closing the window right after typing still saves", async () => {
  const first = await launch();
  await card(first.page, "Summe zweier Zahlen").getByRole("button", { name: "Öffnen" }).click();
  await first.page.locator(".monaco-editor .view-lines").click();
  await first.page.keyboard.press("ControlOrMeta+End");
  await first.page.keyboard.type("// sofort-geschlossen");
  await first.app.close(); // well before the 800 ms autosave delay

  const second = await launch();
  await card(second.page, "Summe zweier Zahlen").getByRole("button", { name: "Weiterarbeiten" }).click();
  await expect(second.page.locator(".monaco-editor .view-lines")).toContainText("sofort-geschlossen");
});

test("harness file is hidden in the file list", async () => {
  const { page } = await launch();
  await card(page, "Größere Zahl").getByRole("button", { name: "Öffnen" }).click();
  const files = page.getByTestId("file-list").getByRole("button");
  await expect(files).toHaveCount(1);
  await expect(files.first()).toContainText("Maximum.java");
});
