import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { join } from "node:path";
import { launch, openExercise, setEditorText, useTempApp } from "./helpers";

useTempApp();

/** Screenshot helper, not a test: with PANEL_SCREENSHOTS=<dir> it writes the screens of M10 (Figma 33-36b) in light and dark. */
const DIR = process.env["PANEL_SCREENSHOTS"];
test.skip(!DIR, "PANEL_SCREENSHOTS is not set");

type Theme = "light" | "dark";
const themes: Theme[] = ["light", "dark"];

async function setTheme(app: ElectronApplication, pages: Page[], theme: Theme): Promise<void> {
  for (const p of pages) await p.emulateMedia({ colorScheme: null }); // Playwright pins light by default
  await app.evaluate(({ nativeTheme }, t) => (nativeTheme.themeSource = t), theme);
  for (const p of pages) {
    await expect.poll(() => p.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(theme === "dark");
  }
}

/** Hovers by moving the mouse onto the element (the tooltips are CSS :hover). */
async function pointAt(page: Page, testid: string, app: ElectronApplication): Promise<void> {
  // :hover only applies in the focused window
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "J;DE")?.focus());
  const box = (await page.getByTestId(testid).boundingBox())!;
  await page.mouse.move(box.x - 40, box.y - 20);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await expect(page.getByTestId(testid)).toHaveCSS("cursor", "pointer");
  await page.waitForTimeout(600);
}

async function panelPage(app: ElectronApplication, panel: string): Promise<Page> {
  let found: Page | undefined;
  await expect.poll(() => (found = app.windows().find((w) => w.url().includes(`panel=${panel}`))) !== undefined).toBe(true);
  return found!;
}

const SUMME_WRONG = `void main() {
    Scanner sc = new Scanner(System.in);
    IO.print("Erste Zahl: ");
    int a = sc.nextInt();
    IO.print("Zweite Zahl: ");
    int b = sc.nextInt();
    int summe = a + b
    IO.println("Summe: " + summe);
}
`;
const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    IO.print("Erste Zahl: ");
    int a = sc.nextInt();
    IO.print("Zweite Zahl: ");
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

test("M10 screens", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  const shoot = async (p: Page, name: string, all: Page[]): Promise<void> => {
    for (const theme of themes) {
      await setTheme(app, all, theme);
      await p.waitForTimeout(300);
      await p.screenshot({ path: join(DIR!, `m10-${name}-${theme}.png`) });
    }
  };

  // 33: the ⧉ buttons (tooltip on the one of the Angabe)
  await setEditorText(app, page, SUMME_WRONG);
  await expect(page.getByTestId("problems-badge")).toBeVisible();
  for (const theme of themes) {
    await setTheme(app, [page], theme);
    await pointAt(page, "detach-assign", app);
    await page.screenshot({ path: join(DIR!, `m10-33-${theme}.png`) });
  }
  await page.mouse.move(600, 400);

  // run once with the correct code so the console and the tests have content
  await setEditorText(app, page, SUMME_RIGHT);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Erste Zahl:");
  await page.keyboard.type("3");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Zweite Zahl:");
  await page.keyboard.type("4");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Programm beendet");
  await setEditorText(app, page, SUMME_RIGHT.replace("(a + b)", "(a - b)"));
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toBeVisible();

  // 34 + 35: Angabe and Tests detached
  await page.getByTestId("detach-assign").click();
  const assign = await panelPage(app, "assign");
  await page.getByTestId("detach-bottom").click(); // Tests is the active tab after Testen
  const tests = await panelPage(app, "tests");
  await expect(tests.getByTestId("tests-banner")).toBeVisible();
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows();
    w.find((x) => x.getTitle().startsWith("J;DE – Angabe"))?.setBounds({ x: 40, y: 40, width: 340, height: 560 });
    w.find((x) => x.getTitle().startsWith("J;DE – Tests"))?.setBounds({ x: 420, y: 120, width: 640, height: 300 });
  });
  await page.waitForTimeout(400);
  for (const theme of themes) {
    await setTheme(app, [page, assign, tests], theme);
    await pointAt(page, "panel-chip-tests", app);
    await page.screenshot({ path: join(DIR!, `m10-34-${theme}.png`) });
  }
  await page.mouse.move(600, 400);
  await shoot(assign, "35-angabe", [page, assign, tests]);
  await shoot(tests, "35-tests", [page, assign, tests]);
  await assign.getByTestId("panel-back").click();
  await tests.getByTestId("panel-back").click();
  await expect(page.getByTestId("assignment")).toBeVisible();

  // 36 + 36b: Code detached
  await page.getByTestId("btab-Konsole").click();
  await page.getByTestId("detach-code").click();
  const code = await panelPage(app, "code");
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((x) => x.getTitle().startsWith("J;DE – Code"))?.setBounds({ x: 100, y: 50, width: 900, height: 560 });
  });
  await expect(code.locator(".monaco-editor .view-lines")).toContainText("Summe");
  await shoot(code, "36", [page, code]);
  await page.mouse.move(600, 600);
  await shoot(page, "36b", [page, code]);
});
