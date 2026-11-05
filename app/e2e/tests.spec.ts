import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, newUserData, openExercise, screenshotDir, setEditorText, useTempApp } from "./helpers";

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
  // match: contains has no line diff: today's view plus a note
  await expect(failed.getByTestId("test-diff")).toHaveCount(0);
  await expect(failed.getByTestId("test-note")).toHaveText("Dieser Text kommt in deiner Ausgabe nicht vor.");
  await page.screenshot({ path: join(screenshotDir, "tests-failed.png") });
});

const SCHNITT_CODE = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Debug: a=" + a);
    IO.println("Summe: " + (a + b));
    IO.println("Durchschnitt: " + (a + b) / 2);
}
`;

/** A temp exercises folder with one exercise that has a trimmed and a lines test (the examples only use contains). */
function schnittExercises(): string {
  const root = newUserData();
  const dir = join(root, "schnitt");
  mkdirSync(join(dir, "files"), { recursive: true });
  writeFileSync(join(dir, "exercise.yaml"), 'id: schnitt\ntitle: "Durchschnitt"\nfiles:\n  - path: Schnitt.java\n    editable: true\nmainFile: Schnitt.java\n');
  writeFileSync(join(dir, "aufgabe.md"), "Gib Summe und Durchschnitt aus.\n");
  writeFileSync(join(dir, "files", "Schnitt.java"), "void main() {\n}\n");
  writeFileSync(
    join(dir, "tests.yaml"),
    `tests:
  - name: "3 und 4 genau"
    type: io
    input: "3\\n4\\n"
    expected: "Summe: 7\\nDurchschnitt: 3.5"
  - name: "3 und 4 Summe 8"
    type: io
    input: "3\\n4\\n"
    expected: "Summe: 8"
    match: lines
  - name: "3 und 4 Summe 7"
    type: io
    input: "3\\n4\\n"
    expected: "Summe: 7"
    match: lines
`
  );
  return root;
}

test("a failed io test shows the line diff; the first one is open, rows toggle", async () => {
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: schnittExercises() });
  await openExercise(page, "Durchschnitt");
  await setEditorText(app, page, SCHNITT_CODE);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("1 von 3 Tests bestanden");

  const first = page.getByTestId("test-row").nth(0);
  const second = page.getByTestId("test-row").nth(1);
  await expect(first.getByTestId("test-head")).toContainText("Eingabe: 3 ⏎ 4 ⏎ · Ausgabe stimmt nicht");
  await expect(first.getByTestId("test-head")).toHaveAttribute("aria-expanded", "true");
  await expect(first.getByTestId("diff-row")).toHaveCount(3);
  expect(await first.getByTestId("diff-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")))).toEqual([
    "extra",
    "equal",
    "different",
  ]);
  await expect(first.getByTestId("diff-tag")).toHaveText(["zu viel", "", "anders"]);
  await expect(first.getByTestId("diff-note")).toContainText("3,5 und 3.5 gelten als gleich.");
  await page.screenshot({ path: join(screenshotDir, "tests-diff.png") });

  // the second failed test starts closed
  await expect(second.getByTestId("test-head")).toHaveAttribute("aria-expanded", "false");
  await expect(second.getByTestId("test-diff")).toHaveCount(0);
  await second.getByTestId("test-head").click();
  expect(await second.getByTestId("diff-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")))).toEqual([
    "missing",
    "ignored",
    "ignored",
    "ignored",
  ]);
  await expect(second.getByTestId("diff-tag")).toHaveText(["fehlt", "ignoriert", "ignoriert", "ignoriert"]);

  // clicking the row collapses it again
  await first.getByTestId("test-head").click();
  await expect(first.getByTestId("test-diff")).toHaveCount(0);
  await first.getByTestId("test-head").click();
  await expect(first.getByTestId("test-diff")).toBeVisible();

  // the passing test has no diff
  await expect(page.getByTestId("test-row").nth(2)).toHaveAttribute("data-status", "passed");
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
