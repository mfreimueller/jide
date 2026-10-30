import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from "@playwright/test";

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

async function open(title: string): Promise<Page> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, JIDE_USER_DATA_DIR: userData, JIDE_EXERCISES_DIR: examplesDir }
  });
  running.push(app);
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId("exercise").filter({ hasText: title }).getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(/\S/);
  return page;
}

const colorOf = (el: Locator) => el.evaluate((node) => getComputedStyle(node).color);

test("editor look: JetBrains Mono, type colours, plain brackets, cursor in the right place", async () => {
  const page = await open("Summe zweier Zahlen");
  const lines = page.locator(".monaco-editor .view-lines");
  await expect(lines).toContainText(/void\s*main/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('14px "JetBrains Mono"'))).toBe(true);

  // uppercase identifiers are types, keywords purple, brackets plain dark text
  expect(await colorOf(lines.locator("span", { hasText: /^Scanner$/ }).first())).toBe("rgb(13, 116, 206)");
  expect(await colorOf(lines.locator("span", { hasText: /^void$/ }).first())).toBe("rgb(142, 78, 198)");
  const brackets = lines.locator("span", { hasText: /^[{}()]+$/ });
  expect(await brackets.count()).toBeGreaterThan(0);
  for (const color of await brackets.evaluateAll((els) => els.map((e) => getComputedStyle(e).color))) {
    expect(color).toBe("rgb(28, 32, 36)");
  }

  // JetBrains Mono at 14px is 8.4px per character; the cursor must sit at the end of the text
  const firstLine = page.locator('.monaco-editor .view-line[style*="top:0px"]');
  await firstLine.click();
  await page.keyboard.press("End");
  const text = (await firstLine.innerText()).replace(/\u00a0/g, " ");
  const box = await firstLine.locator("> span").first().boundingBox();
  const cursor = await page.locator(".monaco-editor .cursors-layer .cursor").first().boundingBox();
  expect(box).toBeTruthy();
  expect(cursor).toBeTruthy();
  expect(text.length).toBeGreaterThan(3);
  expect(box!.width / text.length).toBeCloseTo(8.4, 1);
  expect(Math.abs(cursor!.x - (box!.x + box!.width))).toBeLessThan(1.5);

  await page.screenshot({ path: join(screenshotDir, "editor-look.png") });
});

test("completion: Math.m suggests max and min with German descriptions", async () => {
  const page = await open("Größere Zahl");
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nint test(int a, int b) { return Math.m");
  const widget = page.locator(".suggest-widget");
  await expect(widget).toBeVisible();
  const rows = widget.locator(".monaco-list-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("max");
  await expect(rows.nth(1)).toContainText("min");
  const details = page.locator(".suggest-details");
  await expect(details).toContainText("int Math.max(int a, int b)");
  await expect(details).toContainText("Die größere von zwei Zahlen.");
  await expect(details).toContainText("Beispiel:");
  await page.keyboard.press("ArrowDown");
  await expect(details).toContainText("Die kleinere von zwei Zahlen.");
  await page.screenshot({ path: join(screenshotDir, "completion.png") });

  // accepting inserts a snippet with the parameter placeholders
  await page.keyboard.press("Enter");
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("Math.min(a, b)");
});

test("completion: Scanner variable gives members, unknown receiver gives nothing", async () => {
  const page = await open("Summe zweier Zahlen");
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nvoid t() { Scanner s = new Scanner(System.in); s.");
  await expect(page.getByRole("option", { name: /^nextInt / })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.type("close(); xyz.");
  await expect(page.locator(".suggest-widget")).not.toBeVisible();
});

test("method names in declarations are bold, the colour stays", async () => {
  const page = await open("Größere Zahl");
  const lines = page.locator(".monaco-editor .view-lines");
  await expect(lines).toContainText("maximum");
  const name = lines.locator("span", { hasText: /^maximum$/ }).first();
  expect(await name.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
  expect(await colorOf(name)).toBe("rgb(28, 32, 36)");
  // the return type keyword and the other identifiers are not bold
  const kw = lines.locator("span", { hasText: /^int$/ }).first();
  expect(await kw.evaluate((el) => getComputedStyle(el).fontWeight)).not.toBe("700");
  const a = lines.locator("span", { hasText: /^return$/ }).first();
  expect(await a.evaluate((el) => getComputedStyle(el).fontWeight)).not.toBe("700");
  await page.screenshot({ path: join(screenshotDir, "bold-methods.png") });
});
