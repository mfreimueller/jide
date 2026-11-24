import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { card, launch, openExercise, screenshotDir, setEditorText, useTempApp, userDataDir, screenshot } from "./helpers";
import { dbReachable, login, startBackend, stopAllBackends } from "./online-helpers";

useTempApp();
test.afterEach(stopAllBackends);

const SUMME = "Summe zweier Zahlen";
const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;
const SUMME_BLOCKING = `void main() {
    Scanner sc = new Scanner(System.in);
    sc.nextInt();
}
`;

// ---- T44: stale Tests panel, disabled Testen explains itself (local mode, no database needed) ----

test("the Tests panel shows an amber chip once the code differs from the last run, and drops it when it matches again", async () => {
  const { app, page } = await launch();
  await openExercise(page, SUMME);
  await setEditorText(app, page, SUMME_RIGHT);
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("3 von 3 Tests bestanden");
  await expect(page.getByTestId("tests-time")).toBeVisible();
  await expect(page.getByTestId("tests-stale")).toHaveCount(0);

  await setEditorText(app, page, SUMME_RIGHT + " "); // whitespace at the end only: still the same code
  await expect(page.getByTestId("tests-stale")).toHaveCount(0);

  await setEditorText(app, page, SUMME_RIGHT + "// x");
  await expect(page.getByTestId("tests-stale")).toHaveText("Code geändert – bitte neu testen");
  await expect(page.getByTestId("tests-stale")).toHaveCSS("color", "rgb(171, 100, 0)");

  await setEditorText(app, page, SUMME_RIGHT);
  await expect(page.getByTestId("tests-stale")).toHaveCount(0);

  await setEditorText(app, page, SUMME_RIGHT.replace("a + b", "a - b"));
  await expect(page.getByTestId("tests-stale")).toBeVisible();
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Da sind noch Fehler");
  await expect(page.getByTestId("tests-stale")).toHaveCount(0);
});

test("while a program runs, the disabled Testen button explains why", async () => {
  const { app, page } = await launch();
  await openExercise(page, SUMME);
  await setEditorText(app, page, SUMME_BLOCKING);
  await expect(page.getByTestId("test-wrap")).not.toHaveAttribute("data-tip", /./);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("stop")).toBeEnabled();
  await expect(page.getByTestId("test")).toBeDisabled();
  const wrap = page.getByTestId("test-wrap");
  await expect(wrap).toHaveAttribute("data-tip", "Dein Programm läuft noch. Beende es mit Stopp, dann kannst du testen.");
  await wrap.hover();
  await expect.poll(() => wrap.evaluate((el) => getComputedStyle(el, "::after").content)).toContain("Dein Programm läuft noch");
  await page.getByTestId("stop").click();
  await expect(page.getByTestId("test")).toBeEnabled();
  await expect(wrap).not.toHaveAttribute("data-tip", /./);
});

// ---- T44: bug report in the Abgeben confirmation (online mode: needs the MariaDB of docker-compose.yml) ----

test.describe("bug report", () => {
  test.beforeAll(async () => {
    test.skip(!(await dbReachable()), "MariaDB (docker compose up -d) is not running");
  });

  test("the confirmation has a bug button; the report names the exercise and the change, copies and saves", async () => {
    const backend = await startBackend();
    const { app, page } = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url });
    await login(page, backend.code.toLowerCase());
    await expect(card(page, SUMME)).toBeVisible();
    await openExercise(page, SUMME);

    await page.getByTestId("run").click(); // an event before the hand-in
    await setEditorText(app, page, SUMME_RIGHT);
    await page.getByTestId("test").click();
    await expect(page.getByTestId("tests-banner")).toContainText("3 von 3 Tests bestanden");
    await setEditorText(app, page, SUMME_RIGHT.replace("a + b));", "a + b)); //")); // a real change after the green run

    await page.getByTestId("hand-in").click();
    const dialog = page.getByTestId("hand-in-dialog");
    await expect(dialog).toBeVisible();
    const bug = dialog.getByTestId("bug-report-open");
    await expect(bug).toHaveAttribute("aria-label", "Fehlerbericht für deine Lehrkraft");
    const box = await bug.boundingBox();
    expect(Math.round(box!.width)).toBe(32);
    expect(Math.round(box!.height)).toBe(32);

    await screenshot(page, { path: join(screenshotDir, "bug-confirm.png") });
    await bug.click();
    const report = page.getByTestId("bug-report-text");
    await expect(page.getByTestId("bug-report-dialog")).toContainText("Fehlerbericht");
    await expect(page.getByTestId("bug-report-dialog")).toContainText("Er enthält keine Passwörter oder Codes.");
    await expect(report).toContainText("Aufgabe summe · Paket ");
    await expect(report).toContainText("Online-Modus");
    await expect(report).toContainText("Letzter Testlauf:");
    await expect(report).toContainText("3 / 3 bestanden");
    await expect(report).toContainText("Code seit dem Testlauf geändert: ja");
    await expect(report).toContainText("Summe.java  Testlauf");
    await expect(report).toContainText('jetzt:    "    IO.println(\\"Summe: \\" + (a + b)); //"');
    await expect(report).toContainText("Entscheidung: nachfragen (Code geändert), Ergebnis an Abgabe: keins");
    for (const line of ["Ausführen gedrückt", "Testen gedrückt", "Testen fertig: 3 / 3 bestanden", "Abgeben gedrückt"]) {
      await expect(report).toContainText(line);
    }
    await screenshot(page, { path: join(screenshotDir, "bug-report.png") });
    const text = (await report.textContent())!;
    expect(text).not.toContain(backend.code);
    expect(text).not.toContain(backend.code.replace("-", ""));
    expect(text).not.toMatch(/Bearer/i);

    // Kopieren: the text is on the clipboard
    await app.evaluate(({ clipboard }) => clipboard.writeText("leer"));
    await page.getByTestId("bug-report-copy").click();
    await expect(page.getByTestId("bug-report-copy")).toHaveText("Kopiert");
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(text);

    // Als Datei speichern …: the save dialog is stubbed; the default name carries the exercise id
    const target = join(userDataDir(), "bericht.txt");
    await app.evaluate(({ dialog }, filePath) => {
      (globalThis as Record<string, unknown>)["__saveOptions"] = undefined;
      dialog.showSaveDialog = (async (...args: unknown[]) => {
        (globalThis as Record<string, unknown>)["__saveOptions"] = args[args.length - 1];
        return { canceled: false, filePath };
      }) as typeof dialog.showSaveDialog;
    }, target);
    await page.getByTestId("bug-report-save").click();
    await expect(page.getByTestId("bug-report-note")).toHaveText("Gespeichert");
    expect(readFileSync(target, "utf8")).toBe(text);
    const options = (await app.evaluate(() => (globalThis as Record<string, unknown>)["__saveOptions"])) as { defaultPath: string };
    expect(options.defaultPath).toMatch(/jde-fehlerbericht-summe-\d{8}-\d{4}\.txt$/);

    // Schließen returns to the confirmation, which still works
    await page.getByTestId("bug-report-close").click();
    await expect(page.getByTestId("bug-report-dialog")).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.getByTestId("hand-in-cancel").click();
    await expect(dialog).toHaveCount(0);
  });

  test("a report for code that was never tested says so", async () => {
    const backend = await startBackend();
    const { page } = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url });
    await login(page, backend.code.toLowerCase());
    await openExercise(page, SUMME);
    await page.getByTestId("hand-in").click();
    await page.getByTestId("bug-report-open").click();
    const report = page.getByTestId("bug-report-text");
    await expect(report).toContainText("Letzter Testlauf: keiner");
    await expect(report).toContainText("Entscheidung: nachfragen (noch nie getestet), Ergebnis an Abgabe: keins");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("bug-report-dialog")).toHaveCount(0);
    await expect(page.getByTestId("hand-in-dialog")).toBeVisible();
  });
});
