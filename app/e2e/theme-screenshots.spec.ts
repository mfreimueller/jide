import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, newUserData, openExercise, setEditorText, useTempApp } from "./helpers";

useTempApp();

/** Screenshot helper, not a test: with THEME_SCREENSHOTS=<dir> it writes the main screens in light and dark. */
const DIR = process.env["THEME_SCREENSHOTS"];
test.skip(!DIR, "THEME_SCREENSHOTS is not set");

type Theme = "light" | "dark";
const themes: Theme[] = ["light", "dark"];

async function setTheme(app: ElectronApplication, page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: null }); // Playwright pins light by default
  await app.evaluate(({ nativeTheme }, t) => (nativeTheme.themeSource = t), theme);
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(theme === "dark");
}

async function shoot(app: ElectronApplication, page: Page, name: string): Promise<void> {
  for (const theme of themes) {
    await setTheme(app, page, theme);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(DIR!, `t35-${name}-${theme}.png`) });
  }
}

const SUMME = 'void main() {\n    String name = "Welt";\n    int zahl = 42; // Kommentar\n    IO.println("Hallo " + name + zahl);\n}\n';
const SCHNITT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Debug: a=" + a);
    IO.println("Summe: " + (a + b));
    IO.println("Durchschnitt: " + (a + b) / 2);
}
`;
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><text x="20" y="40" fill="#000">Transparentes Diagramm</text><rect x="20" y="60" width="200" height="80" fill="none" stroke="#000"/></svg>`;

function schnittExercises(): string {
  const root = newUserData();
  const dir = join(root, "schnitt");
  mkdirSync(join(dir, "files"), { recursive: true });
  writeFileSync(join(dir, "exercise.yaml"), 'id: schnitt\ntitle: "Durchschnitt"\nfiles:\n  - path: Schnitt.java\n    editable: true\n  - path: Fest.java\n    editable: false\nmainFile: Schnitt.java\nimages:\n  - path: d.svg\n    title: Diagramm\n');
  writeFileSync(join(dir, "aufgabe.md"), "Gib Summe und Durchschnitt aus.\n\n`code` und **fett**\n");
  writeFileSync(join(dir, "files", "Schnitt.java"), "void main() {\n}\n");
  writeFileSync(join(dir, "files", "d.svg"), SVG);
  writeFileSync(join(dir, "files", "Fest.java"), "class Fest {}\n");
  writeFileSync(
    join(dir, "tests.yaml"),
    `tests:\n  - name: "a"\n    type: io\n    input: "3\\n4\\n"\n    expected: "Summe: 7\\nDurchschnitt: 3.5"\n  - name: "b"\n    type: io\n    input: "3\\n4\\n"\n    expected: "Summe: 8"\n    match: lines\n`
  );
  cpSync(join(examplesDir, "summe"), join(root, "summe"), { recursive: true });
  return root;
}

test("login", async () => {
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: "http://127.0.0.1:1" });
  await expect(page.locator("input").first()).toBeVisible();
  await shoot(app, page, "login");
});

test("exercise list", async () => {
  const { app, page } = await launch();
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  await shoot(app, page, "list");
});

test("workspace with console", async () => {
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: schnittExercises() });
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, SUMME);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Hallo Welt42");
  await expect(page.getByTestId("run")).toBeEnabled();
  await shoot(app, page, "workspace");

});

test("tests panel and image viewer", async () => {
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: schnittExercises() });
  await openExercise(page, "Durchschnitt");
  await setEditorText(app, page, SCHNITT);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Tests bestanden");
  await shoot(app, page, "tests");
  await page.getByTestId("file-list").getByTestId("image-file").first().click();
  await expect(page.getByTestId("image-viewer")).toBeVisible();
  await shoot(app, page, "image");
});

test("exam start and workspace", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-shot-"));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
  cpSync(join(examplesDir, "maximum"), join(examDir, "exercises", "maximum"), { recursive: true });
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await expect(page.getByTestId("exam-start")).toBeVisible();
  await shoot(app, page, "exam-start");
  await page.getByLabel("Vor- und Nachname").fill("Max Muster");
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
  await shoot(app, page, "exam-first-exercise");
  await page.locator('[data-testid="exam-tab"]:visible').nth(1).click();
  await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText("Aufgabe 2: Summe zweier Zahlen");
  await expect(page.locator(".monaco-editor .view-lines:visible")).toBeVisible();
  await setEditorText(app, page, SUMME);
  await page.locator('[data-testid="run"]:visible').click();
  await expect(page.locator('[data-testid="console"]:visible .xterm-rows')).toContainText("Hallo Welt42");
  await shoot(app, page, "exam-workspace");
  await app.evaluate(({ app: a }) => a.exit(0));
});

test("monaco suggest widget", async () => {
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: schnittExercises() });
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, "void main() {\n    String s = \"x\";\n    s.len\n}\n");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("End");
  await page.keyboard.press("Control+Space");
  await expect(page.locator(".suggest-widget.visible")).toBeVisible();
  await shoot(app, page, "monaco-suggest");
  await page.keyboard.press("Escape");

});

test("monaco read-only message", async () => {
  const { page, app } = await launch({ JIDE_EXERCISES_DIR: schnittExercises() });
  await openExercise(page, "Durchschnitt");
  await page.getByTestId("file-list").getByRole("button", { name: /Fest\.java/ }).click();
  await page.locator(".monaco-editor .view-lines:visible").click();
  await page.keyboard.type("x");
  await expect(page.locator("#app p").filter({ hasText: "kann nicht geändert werden" })).toBeVisible();
  await shoot(app, page, "monaco-readonly");
});
