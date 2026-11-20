import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { card, launch, openExercise, screenshotDir, setEditorText, useTempApp } from "./helpers";

useTempApp();

const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;
const TITLE = "Summe zweier Zahlen";

function scratchItems(page: Page) {
  return page.getByTestId("scratch-item").filter({ hasText: TITLE });
}

// Local dev mode lists the examples like server exercises; the copy works the same as online.
test("In Scratch kopieren: menu, dialog, Neu beginnen and Mit meinem Code, Testen in the copy", async () => {
  const { app, page } = await launch();
  await expect(card(page, TITLE)).toBeVisible();

  // the student solves the exercise first
  await openExercise(page, TITLE);
  await setEditorText(app, page, SUMME_RIGHT);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("3 von 3 Tests bestanden");
  await page.getByRole("button", { name: "← Aufgaben" }).click();

  // the menu on the card has the one entry
  await card(page, TITLE).getByTestId("exercise-menu").click();
  await expect(page.getByTestId("exercise-copy")).toHaveText("In Scratch kopieren …");
  await page.screenshot({ path: join(screenshotDir, "scratch-copy-menu.png") });
  await page.getByTestId("exercise-copy").click();

  // the dialog: "Mit meinem Code" is preselected; Abbrechen copies nothing
  const dialog = page.getByTestId("copy-dialog");
  await expect(dialog.getByRole("heading", { name: "In Scratch kopieren" })).toBeVisible();
  await expect(dialog).toContainText(`„${TITLE}“ wird als eigenes Programm in Scratch kopiert – mit Angabe und Tests. Womit willst du starten?`);
  await expect(dialog).toContainText("Neu beginnen");
  await expect(dialog).toContainText("mit dem Startcode der Aufgabe");
  await expect(dialog).toContainText("mit deinem aktuellen Stand");
  await expect(page.getByTestId("copy-mine")).toBeChecked();
  await expect(page.getByTestId("copy-fresh")).not.toBeChecked();
  await page.screenshot({ path: join(screenshotDir, "scratch-copy-dialog.png") });
  await page.getByTestId("copy-cancel").click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);

  // Mit meinem Code (default): the new item appears, it is not opened
  await card(page, TITLE).getByTestId("exercise-menu").click();
  await page.getByTestId("exercise-copy").click();
  await page.getByTestId("copy-confirm").click();
  await expect(dialog).toHaveCount(0);
  await expect(scratchItems(page)).toHaveCount(1);
  await expect(scratchItems(page).getByTestId("scratch-line")).toHaveText("Kopie · 3 Tests");
  await expect(card(page, TITLE)).toHaveCount(1); // the original stays

  // Neu beginnen: a second item
  await card(page, TITLE).getByTestId("exercise-menu").click();
  await page.getByTestId("exercise-copy").click();
  await page.getByTestId("copy-fresh").check();
  await page.getByTestId("copy-confirm").click();
  await expect(scratchItems(page)).toHaveCount(2);
  await page.screenshot({ path: join(screenshotDir, "scratch-copy-list.png") });

  // one copy has the student's code (3 of 3 pass), the other starts fresh (the list order is by id)
  const results: string[] = [];
  for (const n of [0, 1]) {
    await scratchItems(page).nth(n).getByTestId("scratch-open").click();
    await expect(page.getByTestId("hand-in")).toHaveCount(0);
    await expect(page.getByTestId("delete-class")).toHaveCount(0);
    await page.getByTestId("test").click();
    await expect(page.getByTestId("tests-banner")).toBeVisible();
    results.push((await page.getByTestId("tests-banner").innerText()).includes("3 von 3 Tests bestanden") ? "pass" : "fail");
    await page.getByRole("button", { name: "← Aufgaben" }).click();
  }
  expect(results.sort()).toEqual(["fail", "pass"]);
});

