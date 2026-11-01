import { expect, test } from "@playwright/test";
import { chmodSync, cpSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, setEditorText, useTempApp } from "./helpers";

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
});
test.afterEach(() => {
  chmodSync(examDir, 0o755);
  for (const e of readdirSync(examDir, { recursive: true, withFileTypes: true })) {
    if (e.isDirectory()) chmodSync(join(e.parentPath, e.name), 0o755);
  }
  rmSync(examDir, { recursive: true, force: true });
  for (const d of extra.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("exam mode from a read-only folder: lists and opens an exercise, writes nothing into the folder", async () => {
  // read-only: no write permission on any directory
  chmodSync(examDir, 0o555);
  for (const e of readdirSync(examDir, { recursive: true, withFileTypes: true })) {
    if (e.isDirectory()) chmodSync(join(e.parentPath, e.name), 0o555);
  }
  const before = snapshot(examDir);

  // JIDE_EXERCISES_DIR is set by the helper; exam mode must win over it
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await expect(page.getByTestId("exercise")).toHaveCount(1); // only the exam folder, not JIDE_EXERCISES_DIR
  // dark exam bar with the title from exam.json, no network needed
  await expect(page.getByTestId("exam-bar")).toContainText("PRÜFUNG");
  await expect(page.getByTestId("exam-title")).toHaveText("Probe");
  await expect(page.getByTestId("exam-info")).toHaveText("Abgabelaufwerk: P:\\ · kein Internet nötig");
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle())).toBe("J;DE – Prüfungsmodus");
  await openExercise(page, "Summe zweier Zahlen");
  await expect(page.getByRole("button", { name: "Abgeben" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ausführen" })).toBeVisible();

  // writable Electron paths are not inside the exam folder
  const paths = await app.evaluate(({ app: a }) => ({ userData: a.getPath("userData"), sessionData: a.getPath("sessionData"), logs: a.getPath("logs") }));
  for (const p of Object.values(paths)) expect(p.startsWith(examDir)).toBe(false);

  // the JDK found at start-up compiles and runs the exercise
  await setEditorText(app, page, SUMME);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Erste Zahl:");

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
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, SUMME);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("Erste Zahl:");
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
