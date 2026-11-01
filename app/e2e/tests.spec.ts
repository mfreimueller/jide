import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { launch, openExercise, screenshotDir, setEditorText, useTempApp } from "./helpers";

useTempApp();

const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;
const SUMME_WRONG = SUMME_RIGHT.replace("a + b", "a - b");
const MAXIMUM_WRONG = "int maximum(int a, int b) {\n    return a;\n}\n";
const MAXIMUM_RIGHT = "int maximum(int a, int b) {\n    return Math.max(a, b);\n}\n";
const MAXIMUM_THROWS = 'int maximum(int a, int b) {\n    throw new IllegalStateException("kaputt");\n}\n';

test("a correct solution shows the green summary and every row passed", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await expect(page.getByTestId("btab-Tests")).toBeVisible();
  await setEditorText(app, page, SUMME_RIGHT);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("test")).toBeDisabled();
  await expect(page.getByTestId("run")).toBeDisabled();

  await expect(page.getByTestId("tests-banner")).toContainText("Dein Code sieht richtig aus!");
  await expect(page.getByTestId("tests-banner")).toContainText("3 von 3 Tests bestanden");
  await expect(page.getByTestId("btab-Tests")).toHaveClass(/active/);
  await expect(page.getByTestId("tests-badge")).toHaveText("3/3");
  const rows = page.getByTestId("test-row");
  await expect(rows).toHaveCount(3);
  for (const status of await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-status")))) {
    expect(status).toBe("passed");
  }
  await expect(rows.first()).toContainText("3 + 4");
  await expect(page.getByTestId("test")).toBeEnabled();
  await expect(page.getByTestId("run")).toBeEnabled();
  await page.screenshot({ path: join(screenshotDir, "tests-ok.png") });
});

test("a wrong solution shows the warning and expected vs. actual", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, SUMME_WRONG);
  await page.getByTestId("test").click();

  await expect(page.getByTestId("tests-banner")).toContainText("Da sind noch Fehler in deinem Programm.");
  await expect(page.getByTestId("tests-banner")).toContainText("1 von 3 Tests bestanden");
  const failed = page.getByTestId("test-row").filter({ hasText: "3 + 4" });
  await expect(failed).toHaveAttribute("data-status", "failed");
  await expect(failed.getByTestId("test-detail")).toContainText("erwartet: Summe: 7");
  await expect(failed.getByTestId("test-detail")).toContainText("dein Ergebnis: Summe: -1");
  await expect(page.getByTestId("tests-badge")).toHaveText("2");
  await page.screenshot({ path: join(screenshotDir, "tests-failed.png") });
});

test("an exception is an error row with a link to the line", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Größere Zahl");
  await setEditorText(app, page, MAXIMUM_THROWS);
  await page.getByTestId("test").click();
  const row = page.getByTestId("test-row").first();
  await expect(row).toHaveAttribute("data-status", "error");
  await expect(row.getByTestId("test-message")).toContainText("kaputt");
  await page.locator(".monaco-editor .view-line", { hasText: "throw" }).click();
  await page.keyboard.press("Control+End"); // cursor away from the throw line
  await row.click();
  await page.keyboard.type("Z");
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(/Z\s+throw/);
});

test("compile errors run no tests and open Probleme", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, "void main() {\n    int x = ;\n}\n");
  await page.getByTestId("test").click();
  await expect(page.getByTestId("btab-Probleme")).toHaveClass(/active/);
  await expect(page.getByTestId("problem").first()).toBeVisible();
  await page.getByTestId("btab-Konsole").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText(
    "Dein Programm enthält noch Fehler – schau unter Probleme."
  );
  await page.getByTestId("btab-Tests").click();
  await expect(page.getByTestId("test-row")).toHaveCount(0);
});

test("the last result comes back when the exercise is opened again", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Größere Zahl");
  await setEditorText(app, page, MAXIMUM_WRONG);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Da sind noch Fehler");
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await openExercise(page, "Größere Zahl");
  await page.getByTestId("btab-Tests").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Da sind noch Fehler");
  await expect(page.getByTestId("tests-time")).toContainText("zuletzt getestet");

  await setEditorText(app, page, MAXIMUM_RIGHT);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Dein Code sieht richtig aus!");
});
