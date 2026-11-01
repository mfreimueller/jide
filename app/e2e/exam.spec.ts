import { expect, test } from "@playwright/test";
import { chmodSync, cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { examplesDir, launch, setEditorText, useTempApp } from "./helpers";

useTempApp();

let examDir: string;
const extra: string[] = [];

const SUMME = `void main() {
    Scanner sc = new Scanner(System.in);
    IO.print("Erste Zahl: ");
    int a = sc.nextInt();
    IO.println("Summe: " + a);
}
`;

function snapshot(dir: string): string[] {
  return readdirSync(dir, { recursive: true }).map((f) => `${f}:${statSync(join(dir, String(f))).size}`).sort();
}

test.beforeEach(() => {
  examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
  cpSync(join(examplesDir, "maximum"), join(examDir, "exercises", "maximum"), { recursive: true });
});

/** Types the name on the start screen and starts the exam. */
async function startExam(page: Page, name = "Max Muster"): Promise<void> {
  await page.getByLabel("Vor- und Nachname").fill(name);
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
}
test.afterEach(() => {
  chmodSync(examDir, 0o755);
  for (const e of readdirSync(examDir, { recursive: true, withFileTypes: true })) {
    if (e.isDirectory()) chmodSync(join(e.parentPath, e.name), 0o755);
  }
  rmSync(examDir, { recursive: true, force: true });
  for (const d of extra.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("exam mode from a read-only folder: starts, opens an exercise, writes nothing into the folder", async () => {
  // read-only: no write permission on any directory
  chmodSync(examDir, 0o555);
  for (const e of readdirSync(examDir, { recursive: true, withFileTypes: true })) {
    if (e.isDirectory()) chmodSync(join(e.parentPath, e.name), 0o555);
  }
  const before = snapshot(examDir);

  // JIDE_EXERCISES_DIR is set by the helper; exam mode must win over it
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  // only the exam folder (summe + maximum), not JIDE_EXERCISES_DIR; no exercise list in exam mode
  await expect(page.getByTestId("exam-start")).toContainText("2 Aufgaben");
  await expect(page.getByTestId("exercise")).toHaveCount(0);
  // dark exam bar with the title from exam.json, no network needed
  await expect(page.getByTestId("exam-bar")).toContainText("PRÜFUNG");
  await expect(page.getByTestId("exam-title")).toHaveText("Probe");
  await expect(page.getByTestId("exam-info")).toHaveText("Abgabelaufwerk: P:\\ · kein Internet nötig");
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle())).toBe("J;DE – Prüfungsmodus");
  await startExam(page);
  await page.locator('[data-testid="exam-tab"]:visible').nth(1).click(); // summe
  await expect(page.locator(".monaco-editor .view-lines:visible")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abgeben" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ausführen" })).toBeVisible();

  // writable Electron paths are not inside the exam folder
  const paths = await app.evaluate(({ app: a }) => ({ userData: a.getPath("userData"), sessionData: a.getPath("sessionData"), logs: a.getPath("logs") }));
  for (const p of Object.values(paths)) expect(p.startsWith(examDir)).toBe(false);

  // the JDK found at start-up compiles and runs the exercise
  await setEditorText(app, page, SUMME);
  await page.locator('[data-testid="run"]:visible').click();
  await expect(page.locator('[data-testid="console"]:visible .xterm-rows')).toContainText("Erste Zahl:");

  await app.close();
  expect(snapshot(examDir)).toEqual(before);
});

function emptyDir(): string {
  const d = mkdtempSync(join(tmpdir(), "jide-empty-"));
  extra.push(d);
  return d;
}

test("jdkPath from exam.json wins and is used even without JAVA_HOME and PATH", async () => {
  const home = process.env["JAVA_HOME"];
  test.skip(!home, "JAVA_HOME is not set on this machine");
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", jdkPath: home }));
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir, JAVA_HOME: "", PATH: emptyDir() });
  await startExam(page);
  await page.locator('[data-testid="exam-tab"]:visible').nth(1).click(); // Aufgabe 2 = summe (exercises are sorted by id)
  await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText("Aufgabe 2: Summe zweier Zahlen");
  await expect(page.locator(".monaco-editor .view-lines:visible")).toBeVisible();
  await setEditorText(app, page, SUMME);
  await page.locator('[data-testid="run"]:visible').click();
  await expect(page.locator('[data-testid="console"]:visible .xterm-rows')).toContainText("Erste Zahl:");
});

test("start screen: title, hand-in drive, button needs a name, Enter submits", async () => {
  const { page } = await launch({ JIDE_EXAM_DIR: examDir });
  const card = page.getByTestId("exam-start");
  await expect(card.getByRole("heading", { name: "Probe" })).toBeVisible();
  await expect(card).toContainText("Deine Arbeit wird laufend auf dein Abgabelaufwerk P:\\ gesichert.");
  await expect(card).toContainText("2 Aufgaben · Testen ist erlaubt");
  await expect(page.getByTestId("exam-info")).toHaveText("Abgabelaufwerk: P:\\ · kein Internet nötig");
  const button = page.getByRole("button", { name: "Prüfung starten" });
  const input = page.getByLabel("Vor- und Nachname");
  await expect(button).toBeDisabled();
  await input.fill("   ");
  await expect(button).toBeDisabled();
  await input.fill("  Erika Muster ");
  await expect(button).toBeEnabled();
  await input.press("Enter");

  // dark bar: name instead of the title, nothing on the right (reserved for the save status)
  await expect(page.getByTestId("exam-title")).toHaveText("Erika Muster");
  await expect(page.getByTestId("exam-bar")).toContainText("PRÜFUNG");
  await expect(page.getByTestId("exam-info")).toHaveText("");
  await expect(page.getByTestId("exam-start")).toHaveCount(0);
});

test("workspace: tabs per exercise, no list, switching keeps each exercise's edits", async () => {
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(page);
  const tabs = page.locator('[data-testid="exam-tab"]:visible');
  await expect(tabs).toHaveText(["Aufgabe 1", "Aufgabe 2"]);
  await expect(page.getByTestId("exercise")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "← Aufgaben" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abgeben" })).toHaveCount(0);

  // sorted by id: maximum before summe
  await expect(tabs.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText("Aufgabe 1: Größere Zahl");
  await expect(page.locator('[data-testid="assignment"]:visible').getByRole("heading")).toHaveCount(2); // heading + "Beispiel"
  await expect(page.locator('[data-testid="assignment"]:visible').getByRole("heading", { name: "Größere Zahl", exact: true })).toHaveCount(0);

  await setEditorText(app, page, "// meine Aufgabe 1\n");
  await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText("meine Aufgabe 1");

  await tabs.nth(1).click();
  await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText("Aufgabe 2: Summe zweier Zahlen");
  await expect(page.locator(".monaco-editor .view-lines:visible")).not.toContainText("meine Aufgabe 1");
  await setEditorText(app, page, "// meine Aufgabe 2\n");

  await tabs.nth(0).click();
  await expect(page.locator('[data-testid="assignment-heading"]:visible')).toHaveText("Aufgabe 1: Größere Zahl");
  await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText("meine Aufgabe 1");
  await tabs.nth(1).click();
  await expect(page.locator(".monaco-editor .view-lines:visible")).toContainText("meine Aufgabe 2");

  // both exercises were saved to the workspace on switching
  await tabs.nth(0).click();
  await page.waitForTimeout(100);
  const ws = join(await app.evaluate(({ app: a }) => a.getPath("userData")), "workspaces");
  expect(readFileSync(join(ws, "maximum", "Maximum.java"), "utf8")).toContain("meine Aufgabe 1");
  expect(readFileSync(join(ws, "summe", "Summe.java"), "utf8")).toContain("meine Aufgabe 2");
});

test("allowTests: Testen and the Tests tab only when allowed; start screen says so; main refuses", async () => {
  const on = await launch({ JIDE_EXAM_DIR: examDir });
  await expect(on.page.getByTestId("exam-start")).toContainText("2 Aufgaben · Testen ist erlaubt");
  await startExam(on.page);
  await expect(on.page.getByTestId("test")).toBeVisible();
  await expect(on.page.getByTestId("btab-Tests")).toBeVisible();
  await on.app.close();

  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", allowTests: false }));
  const off = await launch({ JIDE_EXAM_DIR: examDir });
  await expect(off.page.getByTestId("exam-start")).toContainText("2 Aufgaben · Testen ist nicht erlaubt");
  await startExam(off.page);
  await expect(off.page.getByTestId("run")).toBeVisible();
  await expect(off.page.getByTestId("test")).toHaveCount(0);
  await expect(off.page.getByTestId("btab-Tests")).toHaveCount(0);
  const r = await off.page.evaluate(() => window.jide.test("summe", []));
  expect(r).toEqual({ ok: false, message: "Testen ist in dieser Prüfung nicht erlaubt." });
});

test("broken exam.json: error screen 09 with the parser message, quit button closes the app", async () => {
  writeFileSync(join(examDir, "exam.json"), '{ "mode": "exam", "titel": "x" }');
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await expect(page.getByRole("heading", { name: "Die Prüfung kann nicht starten" })).toBeVisible();
  await expect(page.getByText("Die Datei exam.json ist fehlerhaft. Bitte gib deiner Lehrkraft Bescheid.")).toBeVisible();
  await expect(page.getByTestId("exam-details")).toContainText('exam.json ist ungültig: Unbekannter Schlüssel "titel".');
  await expect(page.getByText("Für die Lehrkraft: exam.json im Programmordner korrigieren und J;DE neu starten.")).toBeVisible();
  await expect(page.getByTestId("exam-title")).toHaveText("J;DE");
  await expect(page.getByTestId("exam-info")).toHaveText(`Programmordner: ${examDir}`);
  await expect(page.getByTestId("exercise")).toHaveCount(0);

  const closed = new Promise<void>((resolve) => app.process().once("exit", () => resolve()));
  await page.getByRole("button", { name: "J;DE beenden" }).click();
  await closed;
});

test("no usable JDK: error screen 10 lists what was searched", async () => {
  const jdk = emptyDir();
  const javaHome = emptyDir();
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", jdkPath: jdk }));
  const { page } = await launch({ JIDE_EXAM_DIR: examDir, JAVA_HOME: javaHome, PATH: emptyDir() });
  await expect(page.getByRole("heading", { name: "Java 25 wurde nicht gefunden" })).toBeVisible();
  await expect(page.getByTestId("exam-title")).toHaveText("Probe");
  const details = page.getByTestId("exam-details");
  await expect(details).toContainText("Gesucht in dieser Reihenfolge");
  await expect(details).toContainText(`jdkPath (exam.json): ${jdk}`);
  await expect(details).toContainText(`JAVA_HOME: ${javaHome}`);
  await expect(details).toContainText("→ kein java gefunden");
  await expect(details).toContainText("PATH: kein java gefunden");
  await expect(page.getByText("Für die Lehrkraft: JAVA_HOME auf ein JDK 25 setzen oder jdkPath in exam.json eintragen, dann J;DE neu starten.")).toBeVisible();
  await expect(page.getByTestId("exercise")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "J;DE beenden" })).toBeVisible();
});

test("unset JAVA_HOME and unset jdkPath are reported as such", async () => {
  const { page } = await launch({ JIDE_EXAM_DIR: examDir, JAVA_HOME: "", PATH: emptyDir() });
  const details = page.getByTestId("exam-details");
  await expect(details).toContainText("jdkPath (exam.json): nicht gesetzt");
  await expect(details).toContainText("JAVA_HOME: nicht gesetzt");
});
