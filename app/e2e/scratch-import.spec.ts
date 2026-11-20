import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, type Zippable } from "fflate";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { examplesDir, launch, screenshotDir, setEditorText, useTempApp } from "./helpers";

useTempApp();

const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

/** Before login: Scratch only, the server is never asked. */
function launchBeforeLogin() {
  return launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: "http://127.0.0.1:9" });
}

function item(page: Page, title: string) {
  return page.getByTestId("scratch-item").filter({ hasText: title });
}

/** The native dialog cannot be driven: answer it with `path`. */
async function stubOpenDialog(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as unknown as typeof dialog.showOpenDialog;
  }, path);
}

function readDir(dir: string, base = dir, out: Zippable = {}): Zippable {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) readDir(p, base, out);
    else out[p.slice(base.length + 1)] = readFileSync(p);
  }
  return out;
}

test("import a folder and a zip: tests, difficulty, no Abgeben, fixed classes, errors, second copy", async () => {
  const { app, page } = await launchBeforeLogin();
  await page.getByTestId("open-scratch").click();
  await expect(page.getByTestId("scratch-empty")).toBeVisible();

  // the menu offers both entries
  await page.getByTestId("scratch-import").click();
  await expect(page.getByTestId("scratch-import-folder")).toHaveText("Ordner wählen …");
  await expect(page.getByTestId("scratch-import-zip")).toHaveText("ZIP-Datei wählen …");
  await page.screenshot({ path: join(screenshotDir, "scratch-import-menu.png") });

  // a folder that is not an exercise: the German parser error, nothing imported
  const empty = mkdtempSync(join(tmpdir(), "jide-import-empty-"));
  await stubOpenDialog(app, empty);
  await page.getByTestId("scratch-import-folder").click();
  await expect(page.getByTestId("scratch-import-error")).toContainText("exercise.yaml fehlt");
  await expect(page.getByTestId("scratch-empty")).toBeVisible();
  await page.screenshot({ path: join(screenshotDir, "scratch-import-error.png") });
  await page.getByTestId("scratch-import-error-close").click();
  await expect(page.getByTestId("scratch-import-error")).toHaveCount(0);

  // a good folder
  await stubOpenDialog(app, join(examplesDir, "summe"));
  await page.getByTestId("scratch-import").click();
  await page.getByTestId("scratch-import-folder").click();
  const card = item(page, "Summe zweier Zahlen");
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId("scratch-line")).toHaveText("Importiert · 3 Tests");
  await expect(card.getByTestId("difficulty")).toHaveAttribute("data-level", "newbie");
  await page.screenshot({ path: join(screenshotDir, "scratch-import-list.png") });

  // the same exercise as a zip: a second copy
  const zipPath = join(mkdtempSync(join(tmpdir(), "jide-import-zip-")), "summe.zip");
  writeFileSync(zipPath, zipSync(readDir(join(examplesDir, "summe"))));
  await stubOpenDialog(app, zipPath);
  await page.getByTestId("scratch-import").click();
  await page.getByTestId("scratch-import-zip").click();
  await expect(item(page, "Summe zweier Zahlen")).toHaveCount(2);

  // a file that is not a zip
  const notZip = join(mkdtempSync(join(tmpdir(), "jide-import-bad-")), "kaputt.zip");
  mkdirSync(join(notZip, ".."), { recursive: true });
  writeFileSync(notZip, "hallo");
  await stubOpenDialog(app, notZip);
  await page.getByTestId("scratch-import").click();
  await page.getByTestId("scratch-import-zip").click();
  await expect(page.getByTestId("scratch-import-error")).toContainText("kein gültiges ZIP");
  await expect(item(page, "Summe zweier Zahlen")).toHaveCount(2);

  // open one: Testen yes, Abgeben no, the main class is fixed, an added class can be deleted
  await item(page, "Summe zweier Zahlen").first().getByTestId("scratch-open").click();
  await expect(page.getByTestId("file-list")).toContainText("Summe.java");
  await expect(page.getByTestId("hand-in")).toHaveCount(0);
  await expect(page.getByTestId("test")).toBeVisible();
  await expect(page.getByTestId("delete-class")).toHaveCount(0);
  await page.getByTestId("add-class").click();
  await page.getByTestId("text-dialog-input").fill("Extra");
  await page.getByTestId("text-dialog-confirm").click();
  await expect(page.getByTestId("file-list")).toContainText("Extra.java");
  await expect(page.getByTestId("delete-class")).toHaveCount(1);

  await page.getByTestId("file-list").getByRole("button", { name: /^J\s*Summe\.java/ }).click();
  await setEditorText(app, page, SUMME_RIGHT);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("3 von 3 Tests bestanden");
  await page.screenshot({ path: join(screenshotDir, "scratch-import-workspace.png") });

  // rename and delete like any Scratch item
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await item(page, "Summe zweier Zahlen").first().getByTestId("scratch-menu").click();
  await page.getByTestId("scratch-rename").click();
  await page.getByTestId("text-dialog-input").fill("Meine Summe");
  await page.getByTestId("text-dialog-confirm").click();
  await expect(item(page, "Meine Summe").getByTestId("scratch-line")).toHaveText("Importiert · 3 Tests");
  await item(page, "Meine Summe").getByTestId("scratch-menu").click();
  await page.getByTestId("scratch-delete").click();
  await page.getByTestId("text-dialog-confirm").click();
  await expect(item(page, "Meine Summe")).toHaveCount(0);
  await expect(item(page, "Summe zweier Zahlen")).toHaveCount(1);
});
