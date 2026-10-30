import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { launch, openExercise, screenshotDir, useTempApp } from "./helpers";

useTempApp();

test("a missing semicolon shows a marker, a Probleme entry and a badge", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await page.locator(".monaco-editor .view-line", { hasText: "new Scanner" }).click(); // line 2
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace"); // deletes the ";"

  await expect(page.locator(".monaco-editor .squiggly-error").first()).toBeAttached({ timeout: 3000 });
  await expect(page.getByTestId("problems-badge")).toHaveText("1");
  await expect(page.getByTestId("file-errors")).toHaveText("1");

  await page.getByTestId("btab-Probleme").click();
  const entry = page.getByTestId("problem");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("';' erwartet");
  await expect(entry).toContainText("Summe.java:2");
  await page.screenshot({ path: join(screenshotDir, "probleme.png") });

  // move the cursor away, then click the entry: the cursor goes to the error position (right after the ")")
  await page.locator(".monaco-editor .view-line", { hasText: "Dein Code" }).click(); // line 3
  await entry.click();
  await page.keyboard.type("Z");
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("System.in)Z");
});

test("without problems the list says so", async () => {
  const { page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await page.getByTestId("btab-Probleme").click();
  await expect(page.getByTestId("bottom-Probleme")).toContainText("Keine Probleme gefunden.");
  await expect(page.getByTestId("problems-badge")).toHaveCount(0);
});
