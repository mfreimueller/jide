import { expect, test } from "@playwright/test";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { examplesDir, launch, newUserData, setEditorText, useTempApp } from "./helpers";

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
  // waits until summe is shown: right after the click the previous exercise's editor is still visible
  await gotoTab(page, 1); // summe
  await expect(page.getByRole("button", { name: "Abgeben" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ausführen" })).toBeVisible();

  // writable Electron paths are not inside the exam folder
  const paths = await app.evaluate(({ app: a }) => ({ userData: a.getPath("userData"), sessionData: a.getPath("sessionData"), logs: a.getPath("logs") }));
  for (const p of Object.values(paths)) expect(p.startsWith(examDir)).toBe(false);

  // the JDK found at start-up compiles and runs the exercise
  await setEditorText(app, page, SUMME);
  await page.locator('[data-testid="run"]:visible').click();
  await expect(page.locator('[data-testid="console"]:visible .xterm-rows')).toContainText("Erste Zahl:");

  // un-handed-in changes: closing asks; leaving anyway writes nothing into the exam folder either
  const closed = page.waitForEvent("close"); // macOS keeps the process alive without windows
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await page.getByTestId("close-leave").click();
  await closed;
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
  await expect(page.locator('[data-testid="exam-save-status"]')).toHaveCount(0); // nothing saved yet

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
  // exam workspaces are scoped per exam and student: one folder below workspaces/
  const wsBase = join(await app.evaluate(({ app: a }) => a.getPath("userData")), "workspaces");
  const scoped = readdirSync(wsBase);
  expect(scoped).toHaveLength(1);
  const ws = join(wsBase, scoped[0]!);
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
  const r = await off.page.evaluate(() => (window as unknown as { jide: { test: (id: string, files: unknown[]) => Promise<unknown> } }).jide.test("summe", []));
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

// ---------------------------------------------------------------- T25: hand-in, autosave, restore, close

const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

/** A hand-in drive (a temp folder) and an exam.json that points to it. */
function useDrive(config: Record<string, unknown> = {}): string {
  const drive = mkdtempSync(join(tmpdir(), "jide-drive-"));
  extra.push(drive);
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: drive, ...config }));
  return drive;
}

const editor = (page: Page) => page.locator(".monaco-editor .view-lines:visible");
const tab = (page: Page, n: number) => page.locator('[data-testid="exam-tab"]:visible').nth(n);
/** Clicks the tab and waits until its exercise is shown (the previous one is hidden by then). */
async function gotoTab(page: Page, n: number): Promise<void> {
  await tab(page, n).click();
  await expect(tab(page, n)).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page)).toBeVisible();
}
const status = (page: Page) => page.getByTestId("exam-save-status");

async function waitForFile(file: string): Promise<void> {
  await expect.poll(() => existsSync(file), { timeout: 15_000 }).toBe(true);
}

test("hand-in: files + abgabe.json with name and test summary, toast, green status, chip survives a restart", async () => {
  const drive = useDrive();
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(page, "Max Muster");
  await gotoTab(page, 1); // summe
  await setEditorText(app, page, SUMME_RIGHT);
  await page.locator('[data-testid="test"]:visible').click();
  await expect(page.locator('[data-testid="tests-banner"]:visible')).toContainText("3 von 3 Tests bestanden");

  // all tests passed and the code is unchanged: no confirmation
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(page.getByTestId("hand-in-dialog")).toHaveCount(0);
  await expect(page.getByTestId("toast")).toHaveText(new RegExp(`Abgabe gespeichert auf ${drive.replace(/[\\/.]/g, "\\$&")} – \\d\\d:\\d\\d`));
  await expect(status(page)).toHaveAttribute("data-tone", "ok");
  await expect(status(page)).toHaveText(new RegExp(`^● zuletzt gesichert auf ${drive.replace(/[\\/.]/g, "\\$&")} um \\d\\d:\\d\\d$`));
  await expect(status(page)).toHaveCSS("color", "rgb(124, 226, 166)");
  await expect(page.getByTestId("handed-in").first()).toContainText("Abgegeben");
  await expect(page.getByRole("button", { name: "Erneut abgeben" })).toBeVisible();

  expect(readFileSync(join(drive, "summe", "Summe.java"), "utf8")).toBe(SUMME_RIGHT);
  const abgabe = JSON.parse(readFileSync(join(drive, "summe", "abgabe.json"), "utf8"));
  expect(abgabe).toMatchObject({ name: "Max Muster", exercise: "summe", title: "Summe zweier Zahlen", testSummary: { passed: 3, total: 3 }, files: ["Summe.java"] });
  expect(abgabe.submittedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);

  // nothing changed since the hand-in: closing does not ask
  const closed = page.waitForEvent("close");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await closed;

  // restart with an empty user-data dir: "abgegeben" comes back from abgabe.json
  const second = await launch({ JIDE_EXAM_DIR: examDir }, newUserData());
  await startExam(second.page, "MAX muster");
  await gotoTab(second.page, 1);
  await expect(second.page.getByRole("button", { name: "Erneut abgeben" })).toBeVisible();
  await expect(second.page.getByTestId("handed-in").first()).toContainText("Abgegeben");
  await expect(editor(second.page)).toContainText("Summe: ");
  await expect(editor(second.page)).toContainText("a + b");
});

test("hand-in of the starter code without tests run asks first; allowTests false never asks", async () => {
  const drive = useDrive();
  const { page } = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(page);
  await gotoTab(page, 1);
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await expect(page.getByTestId("hand-in-dialog")).toBeVisible();
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert auf");
  expect(JSON.parse(readFileSync(join(drive, "summe", "abgabe.json"), "utf8")).testSummary).toBeNull();

  // allowTests false: no tests, so no confirmation
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: drive, allowTests: false }));
  const off = await launch({ JIDE_EXAM_DIR: examDir }, newUserData());
  await startExam(off.page);
  await gotoTab(off.page, 1);
  await off.page.getByRole("button", { name: /abgeben/i }).click();
  await expect(off.page.getByTestId("hand-in-dialog")).toHaveCount(0);
  await expect(off.page.getByTestId("toast")).toContainText("Abgabe gespeichert auf");
});

test("autosave: after a run and on a tab switch, with name; skipped while unchanged", async () => {
  const drive = useDrive();
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(page, "Erika Muster");
  await gotoTab(page, 1); // summe
  await setEditorText(app, page, "// nach dem Ausführen\nvoid main() {}\n");
  await page.locator('[data-testid="run"]:visible').click();
  const auto = join(drive, "summe", "_autosave");
  await waitForFile(join(auto, "autosave.json"));
  await expect(status(page)).toHaveAttribute("data-tone", "ok");
  expect(readFileSync(join(auto, "Summe.java"), "utf8")).toBe("// nach dem Ausführen\nvoid main() {}\n");
  const saved = JSON.parse(readFileSync(join(auto, "autosave.json"), "utf8"));
  expect(saved).toMatchObject({ name: "Erika Muster", exercise: "summe" });
  expect(saved.savedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  expect(existsSync(join(drive, "summe", "abgabe.json"))).toBe(false); // an autosave is not a hand-in

  // switching tabs saves the exercise that was left (and autosaves the first one for the first time)
  await setEditorText(app, page, "// beim Wechseln\nvoid main() {}\n");
  await gotoTab(page, 0);
  await expect.poll(() => readFileSync(join(auto, "Summe.java"), "utf8")).toBe("// beim Wechseln\nvoid main() {}\n");
});

test("autosave runs by itself on the interval (JIDE_AUTOSAVE_MS)", async () => {
  const drive = useDrive();
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir, JIDE_AUTOSAVE_MS: "400" });
  await startExam(page);
  await gotoTab(page, 1);
  await setEditorText(app, page, "// nur durch das Intervall\n");
  await expect.poll(() => existsSync(join(drive, "summe", "_autosave", "Summe.java")) && readFileSync(join(drive, "summe", "_autosave", "Summe.java"), "utf8"), { timeout: 15_000 }).toBe("// nur durch das Intervall\n");
  await expect(status(page)).toHaveAttribute("data-tone", "ok");
});

test("restore after a restart with an EMPTY user-data dir: the newest of autosave and hand-in wins", async () => {
  const drive = useDrive();
  const first = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(first.page, "Max Muster");
  await gotoTab(first.page, 1);
  await setEditorText(first.app, first.page, "// Abgabe 1\n");
  await first.page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await first.page.getByTestId("hand-in-confirm").click();
  await expect(first.page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await setEditorText(first.app, first.page, "// Autosave 2\n");
  await gotoTab(first.page, 0); // autosave of the exercise that was left
  await expect.poll(() => readFileSync(join(drive, "summe", "_autosave", "Summe.java"), "utf8")).toBe("// Autosave 2\n");
  // autosave.json is written right after the files: wait until its time is past the hand-in before the crash
  const time = (file: string, key: string): number => {
    try {
      return Date.parse(JSON.parse(readFileSync(join(drive, "summe", file), "utf8"))[key]);
    } catch {
      return Number.NaN;
    }
  };
  await expect.poll(() => time("_autosave/autosave.json", "savedAt") > time("abgabe.json", "submittedAt")).toBe(true);
  await first.app.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined); // crash: no close handling

  // autosave is newer than the hand-in
  const second = await launch({ JIDE_EXAM_DIR: examDir }, newUserData());
  await startExam(second.page, "Max Muster");
  await gotoTab(second.page, 1);
  await expect(editor(second.page)).toContainText("Autosave 2");
  await expect(second.page.getByRole("button", { name: "Erneut abgeben" })).toBeVisible(); // the hand-in is known too
  // hand in again: now the hand-in is the newest
  await second.page.getByRole("button", { name: "Erneut abgeben" }).click();
  await second.page.getByTestId("hand-in-confirm").click();
  await expect(second.page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await second.app.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined);

  const third = await launch({ JIDE_EXAM_DIR: examDir }, newUserData());
  await startExam(third.page, "Max Muster");
  await gotoTab(third.page, 1);
  await expect(editor(third.page)).toContainText("Autosave 2");

  // another name on the same drive: nothing is restored
  const other = await launch({ JIDE_EXAM_DIR: examDir }, newUserData());
  await startExam(other.page, "Erika Muster");
  await gotoTab(other.page, 1);
  await expect(editor(other.page)).not.toContainText("Autosave 2");
  await expect(editor(other.page)).toContainText("void main()");
});

test("hand-in drive not reachable: amber status, error toast on Abgeben, work stays, retry works", async () => {
  const drive = join(mkdtempSync(join(tmpdir(), "jide-gone-")), "P");
  extra.push(join(drive, ".."));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: drive }));
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(page);
  await gotoTab(page, 1);
  await setEditorText(app, page, "// bleibt lokal\n");
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toHaveText(`!Abgabe nicht gespeichert – ${drive} ist nicht erreichbar. Versuch es gleich nochmal.`);
  await expect(status(page)).toHaveAttribute("data-tone", "warn");
  await expect(status(page)).toHaveText(`● ${drive} nicht erreichbar – deine Arbeit ist nur auf diesem PC gesichert`);
  await expect(status(page)).toHaveCSS("color", "rgb(255, 181, 51)");
  await expect(page.getByRole("button", { name: "Abgeben", exact: true })).toBeVisible(); // not handed in
  await expect(editor(page)).toContainText("bleibt lokal");
  expect(existsSync(drive)).toBe(false); // the missing drive is not invented

  // the drive comes back: the student clicks again
  mkdirSync(drive);
  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert auf");
  await expect(status(page)).toHaveAttribute("data-tone", "ok");
  expect(readFileSync(join(drive, "summe", "Summe.java"), "utf8")).toBe("// bleibt lokal\n");
});

test("autosave keeps retrying: amber while the drive is away, green once it is back", async () => {
  const drive = join(mkdtempSync(join(tmpdir(), "jide-gone-")), "P");
  extra.push(join(drive, ".."));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: drive }));
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir, JIDE_AUTOSAVE_MS: "400" });
  await startExam(page);
  await gotoTab(page, 1);
  await setEditorText(app, page, "// Laufwerk fehlt\n");
  await expect(status(page)).toHaveAttribute("data-tone", "warn");
  mkdirSync(drive);
  await expect(status(page)).toHaveAttribute("data-tone", "ok");
  // green may come from the other tab's autosave; the summe file follows in the same pass
  const autosaved = (): string | null => {
    try {
      return readFileSync(join(drive, "summe", "_autosave", "Summe.java"), "utf8");
    } catch {
      return null;
    }
  };
  await expect.poll(autosaved, { timeout: 10_000 }).toBe("// Laufwerk fehlt\n");
});

test("closing with changes that were not handed in asks; Weiterarbeiten keeps the app; after a hand-in it does not ask", async () => {
  const drive = useDrive();
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await startExam(page);
  await gotoTab(page, 1);
  await setEditorText(app, page, "// ungesichert\n");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  const dialog = page.getByTestId("close-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Wirklich beenden?" })).toBeVisible();
  await expect(dialog).toContainText("Du hast deine letzten Änderungen noch nicht abgegeben.");
  // closing saved a copy to the drive first
  expect(readFileSync(join(drive, "summe", "_autosave", "Summe.java"), "utf8")).toBe("// ungesichert\n");
  await dialog.getByRole("button", { name: "Weiterarbeiten" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await expect(editor(page)).toContainText("ungesichert");

  // asking again works, too
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); // = Weiterarbeiten
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Abgeben", exact: true }).click();
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  const closed = page.waitForEvent("close");
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
  await closed;
});

test("workspaces of two students (or two exams) on the same Windows account do not mix", async () => {
  useDrive();
  const data = newUserData();
  const a = await launch({ JIDE_EXAM_DIR: examDir }, data);
  await startExam(a.page, "Anna Alpha");
  await gotoTab(a.page, 1);
  await setEditorText(a.app, a.page, "// Annas Arbeit\n");
  await gotoTab(a.page, 0); // saved
  await a.app.evaluate(({ app: x }) => x.exit(0)).catch(() => undefined);

  // same user-data dir, other student, other drive folder
  const drive2 = useDrive();
  const b = await launch({ JIDE_EXAM_DIR: examDir }, data);
  await startExam(b.page, "Berta Beta");
  await gotoTab(b.page, 1);
  await expect(editor(b.page)).not.toContainText("Annas Arbeit");
  expect(readdirSync(join(data, "workspaces")).length).toBe(2);
  expect(existsSync(join(drive2, "summe", "abgabe.json"))).toBe(false);
});
