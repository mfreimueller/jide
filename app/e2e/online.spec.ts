import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { card, launch, newUserData, openExercise, screenshotDir, setEditorText, useTempApp, userDataDir, screenshot } from "./helpers";
import { dbReachable, login, startBackend, stopAllBackends, type Backend } from "./online-helpers";

useTempApp();

test.beforeAll(async () => {
  test.skip(!(await dbReachable()), "MariaDB (docker compose up -d) is not running");
});
test.afterEach(stopAllBackends);

const SUMME = "Summe zweier Zahlen";
const NEW_CODE = 'void main() {\n    IO.println("ABGABE-EINS");\n}\n';

async function launchOnline(backend: Backend, userData?: string) {
  return launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url }, userData);
}

async function loggedIn(backend: Backend, userData?: string) {
  const l = await launchOnline(backend, userData);
  await login(l.page, backend.code.toLowerCase());
  await expect(card(l.page, SUMME)).toBeVisible();
  return l;
}

async function latestHandIn(backend: Backend, code: string): Promise<{ files: { path: string; content: string }[] } | undefined> {
  const r = await fetch(`${backend.url}/api/exercises/summe/handins/latest`, { headers: { Authorization: `Bearer ${code}` } });
  return r.ok ? ((await r.json()) as { files: { path: string; content: string }[] }) : undefined;
}

/** Both sample exercises have tests, so a hand-in without a green run asks first: this confirms. */
async function handIn(page: Page): Promise<void> {
  await page.getByTestId("hand-in").click();
  await page.getByTestId("hand-in-confirm").click();
}

test("a wrong code stays on the login with the server's message", async () => {
  const backend = await startBackend();
  const { page } = await launchOnline(backend);
  await expect(page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
  await screenshot(page, { path: join(screenshotDir, "online-login.png") });
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeDisabled();
  await login(page, "AAAA-AAAA");
  await expect(page.getByTestId("login-error")).toContainText("Dieser Code ist ungültig");
  await expect(page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
});

test("login with a lower-case code lists the unlocked exercises", async () => {
  const backend = await startBackend();
  const { page } = await launchOnline(backend);
  // pasting works as well as typing: dash and lower case are fine
  await login(page, backend.code.toLowerCase());
  await expect(page.getByTestId("student")).toContainText("Anna Huber");
  await expect(page.getByTestId("course")).toHaveText("POS · 1AHIF");
  await expect(page.getByTestId("sync")).toHaveText("Verbunden");
  await expect(card(page, SUMME)).toContainText("Neu");
  await expect(card(page, SUMME)).toContainText("bis Do, 27.11."); // 2031-11-27T22:59Z = 23:59 in Vienna
  await expect(card(page, "Größere Zahl")).toContainText("Frist vorbei · Abgabe noch möglich");
  await expect(page.getByTestId("offline-hint")).toHaveCount(0);
  await screenshot(page, { path: join(screenshotDir, "online-list.png") });
});

test("open, edit and hand in; the hand-in is on the server", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await expect(page.getByTestId("deadline")).toContainText("Abgabe bis Do, 27.11.");
  await setEditorText(app, page, NEW_CODE);
  // no manual wait: handing in flushes pending autosave first
  await handIn(page);
  await expect(page.getByTestId("toast")).toContainText(/Abgabe gespeichert – \w\w, \d+\.\d+\. um \d\d:\d\d/);
  await expect(page.getByTestId("handed-in")).toContainText("Abgegeben");
  await expect(page.getByTestId("hand-in")).toHaveText("Erneut abgeben");
  await screenshot(page, { path: join(screenshotDir, "online-handin.png") });

  const latest = await latestHandIn(backend, backend.code);
  expect(latest?.files.find((f) => f.path === "Summe.java")?.content).toBe(NEW_CODE);

  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(card(page, SUMME)).toContainText("Abgegeben");
  await expect(card(page, SUMME)).toContainText("Zuletzt abgegeben:");
  await expect(card(page, SUMME).getByRole("button", { name: "Ansehen" })).toBeVisible();
});

test("a fresh laptop starts from the last hand-in", async () => {
  const backend = await startBackend();
  const first = await loggedIn(backend);
  await openExercise(first.page, SUMME);
  await setEditorText(first.app, first.page, NEW_CODE);
  await handIn(first.page);
  await expect(first.page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await first.app.close();

  const second = await launchOnline(backend, newUserData());
  await login(second.page, backend.code);
  // not worked on here, but handed in elsewhere: the list says so after opening; open it
  await openExercise(second.page, SUMME);
  await expect(second.page.locator(".monaco-editor .view-lines")).toContainText("ABGABE-EINS");
  await expect(second.page.getByTestId("handed-in")).toBeVisible();
  // the other exercise has no hand-in: starter code
  await second.page.getByRole("button", { name: "← Aufgaben" }).click();
  await openExercise(second.page, "Größere Zahl");
  await expect(second.page.locator(".monaco-editor .view-lines")).not.toContainText("ABGABE-EINS");
});

test("a hand-in after the deadline is marked verspätet, also after a restart and on a new laptop", async () => {
  const backend = await startBackend();
  const first = await loggedIn(backend);
  await openExercise(first.page, "Größere Zahl");
  await expect(first.page.getByTestId("handed-in")).toHaveCount(0);
  await setEditorText(first.app, first.page, "int maximum(int a, int b) { return a; }\n");
  await handIn(first.page);
  await expect(first.page.getByTestId("toast")).toContainText(/Abgabe gespeichert – verspätet \(\w\w, \d+\.\d+\. um \d\d:\d\d\)/);
  await expect(first.page.getByTestId("handed-in")).toContainText("Abgegeben · verspätet");
  await screenshot(first.page, { path: join(screenshotDir, "online-handin-late.png") });
  await first.page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(card(first.page, "Größere Zahl")).toContainText("Abgegeben · verspätet");
  await first.app.close();

  // restart: kept in handins.json
  const again = await launchOnline(backend, userDataDir());
  await expect(card(again.page, "Größere Zahl")).toContainText("Abgegeben · verspätet");
  await again.app.close();

  // new laptop: derived from the restored hand-in and the deadline
  const second = await launchOnline(backend, newUserData());
  await login(second.page, backend.code);
  await openExercise(second.page, "Größere Zahl");
  await expect(second.page.getByTestId("handed-in")).toContainText("Abgegeben · verspätet");
});

test("an exercise deleted on the server is gone from the list at the next refresh; the local copy stays", async () => {
  const backend = await startBackend();
  const { page, app } = await loggedIn(backend);
  await openExercise(page, SUMME); // creates the local workspace
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(card(page, SUMME)).toBeVisible();

  await backend.deleteExercise("summe");
  await page.reload();
  await expect(card(page, "Größere Zahl")).toBeVisible();
  await expect(card(page, SUMME)).toHaveCount(0);
  expect(existsSync(join(userDataDir(), "workspaces", "summe"))).toBe(true);

  // also after a restart: the cached list was rewritten, not merged
  await app.close();
  const again = await launchOnline(backend);
  await expect(card(again.page, "Größere Zahl")).toBeVisible();
  await expect(card(again.page, SUMME)).toHaveCount(0);
});

const HEADINGS = (page: Page) => page.getByTestId("group-heading");

/** Hands in through the app (the list's "Abgegeben" status is the local hand-in record) and goes back to the list. */
async function handInAndBack(l: Awaited<ReturnType<typeof loggedIn>>, title: string): Promise<void> {
  await openExercise(l.page, title);
  await setEditorText(l.app, l.page, "void main() {}\n");
  await handIn(l.page);
  await expect(l.page.getByTestId("handed-in")).toContainText("Abgegeben");
  await l.page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(card(l.page, title)).toBeVisible();
}

test("groups show newest unlock first with their progress; handing in updates it", async () => {
  const backend = await startBackend();
  await backend.setGroups([
    { name: "Fortgeschritten", exercises: ["summe"] },
    { name: "Erste Schritte", exercises: ["maximum"] }
  ]);
  const l = await loggedIn(backend);
  const page = l.page;
  await expect(HEADINGS(page)).toHaveCount(2);
  await expect(HEADINGS(page).nth(0)).toContainText("Fortgeschritten");
  await expect(HEADINGS(page).nth(0)).toContainText("0 / 1 abgegeben");
  await expect(HEADINGS(page).nth(1)).toContainText("Erste Schritte");
  await expect(HEADINGS(page).nth(1)).toContainText("0 / 1 abgegeben");
  await expect(page.getByText("Offen", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Abgegeben", { exact: true })).toHaveCount(0);

  // group order beats open / handed-in order: the handed-in group of the first position stays first
  await handInAndBack(l, SUMME);
  await expect(HEADINGS(page).nth(0)).toContainText("1 / 1 abgegeben");
  await expect(HEADINGS(page).nth(1)).toContainText("0 / 1 abgegeben");
  await expect(page.getByTestId("exercise").nth(0)).toContainText(SUMME);
  await expect(page.getByTestId("exercise").nth(1)).toContainText("Größere Zahl");
  await screenshot(page, { path: join(screenshotDir, "online-list-groups.png") });
});

test("the card shows the kind from the backend; one without a stored kind shows Pflicht", async () => {
  const backend = await startBackend();
  const { page } = await loggedIn(backend);
  const card = (title: string) => page.getByTestId("exercise").filter({ hasText: title });
  await expect(card(SUMME).getByTestId("kind")).toHaveText("Pflicht");
  await expect(card("Größere Zahl").getByTestId("kind")).toHaveText("Pflicht");
  await expect(card("Größere Zahl").getByTestId("kind")).toHaveAttribute("data-kind", "pflicht");
});

test("ungrouped exercises come last under Weitere Übungen", async () => {
  const backend = await startBackend();
  await backend.setGroups([{ name: "Erste Schritte", exercises: ["maximum"] }]);
  const { page } = await loggedIn(backend);
  await expect(HEADINGS(page)).toHaveCount(2);
  await expect(HEADINGS(page).nth(0)).toContainText("Erste Schritte");
  await expect(HEADINGS(page).nth(1)).toHaveText("Weitere Übungen");
  await expect(page.getByTestId("exercise").nth(0)).toContainText("Größere Zahl");
  await expect(page.getByTestId("exercise").nth(1)).toContainText(SUMME);
  await screenshot(page, { path: join(screenshotDir, "online-list-groups-other.png") });
});

test("a course without groups shows a plain list without headings, open before handed in", async () => {
  const backend = await startBackend();
  const l = await loggedIn(backend);
  // "Größere Zahl" is after "Summe" only once it is handed in
  await expect(l.page.getByTestId("exercise").nth(0)).toContainText("Größere Zahl");
  await handInAndBack(l, "Größere Zahl");
  await expect(l.page.getByTestId("exercise")).toHaveCount(2);
  await expect(l.page.getByTestId("exercise").nth(0)).toContainText(SUMME);
  await expect(l.page.getByTestId("exercise").nth(1)).toContainText("Abgegeben");
  await expect(HEADINGS(l.page)).toHaveCount(0);
  await expect(l.page.locator(".section-title")).toHaveCount(0);
});

test("offline start keeps the groups of the cached list", async () => {
  const backend = await startBackend();
  await backend.setGroups([
    { name: "Fortgeschritten", exercises: ["summe"] },
    { name: "Erste Schritte", exercises: ["maximum"] }
  ]);
  const first = await loggedIn(backend);
  await expect(HEADINGS(first.page)).toHaveCount(2);
  await first.app.close();
  await backend.stop();

  const { page } = await launchOnline(backend);
  await expect(page.getByTestId("offline-hint")).toBeVisible();
  await expect(HEADINGS(page)).toHaveCount(2);
  await expect(HEADINGS(page).nth(0)).toContainText("Fortgeschritten");
  await expect(HEADINGS(page).nth(1)).toContainText("Erste Schritte");
});

test("handing in to an exercise deleted meanwhile shows the server's German message and nothing crashes", async () => {
  const backend = await startBackend();
  const { page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await backend.deleteExercise("summe");
  await handIn(page);
  await expect(page.getByTestId("toast")).toContainText("Diese Aufgabe ist nicht verfügbar.");
  await expect(page.getByTestId("handed-in")).toHaveCount(0);
});

test("offline start shows the cached list; editing works; Abgeben says there is no connection", async () => {
  const backend = await startBackend();
  const first = await loggedIn(backend);
  await openExercise(first.page, SUMME); // creates the local workspace
  await first.app.close();
  await backend.stop();

  const { app, page } = await launchOnline(backend);
  await expect(card(page, SUMME)).toBeVisible();
  await expect(card(page, "Größere Zahl")).toBeVisible();
  await expect(page.getByTestId("offline-hint")).toHaveText("Offline – du siehst die zuletzt geladenen Aufgaben.");
  await expect(page.getByTestId("sync")).toHaveText("Offline");
  await expect(page.getByTestId("student")).toContainText("Anna Huber");
  await screenshot(page, { path: join(screenshotDir, "online-list-offline.png") });

  await openExercise(page, SUMME);
  await setEditorText(app, page, 'void main() {\n    IO.println("OFFLINE-ARBEIT");\n}\n');
  await expect(page.getByTestId("save-status")).toHaveText("Gespeichert");
  await handIn(page);
  await expect(page.getByTestId("toast")).toHaveText(/Keine Verbindung – versuch es gleich nochmal\./);
  await screenshot(page, { path: join(screenshotDir, "online-handin-offline.png") });
  await expect(page.getByTestId("handed-in")).toHaveCount(0);
});

test("a reset code sends the student back to the login", async () => {
  const backend = await startBackend();
  const first = await loggedIn(backend);
  await first.app.close();
  expect(JSON.parse(readFileSync(join(userDataDir(), "session.json"), "utf8")).code).toMatch(/^[A-Z0-9]{8}$/);

  const newCode = await backend.resetCode();
  const { page } = await launchOnline(backend);
  await expect(page.getByTestId("login-notice")).toHaveText(
    "Dein Code ist nicht mehr gültig. Frag deine Lehrkraft nach dem neuen Zettel."
  );
  await screenshot(page, { path: join(screenshotDir, "online-login-expired.png") });
  // the stored code is gone; the new slip works
  await login(page, newCode);
  await expect(card(page, SUMME)).toBeVisible();
});

test("Abmelden in the menu deletes the code and shows the login", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await app.evaluate(({ dialog, Menu }) => {
    dialog.showMessageBox = (async () => ({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox;
    Menu.getApplicationMenu()?.getMenuItemById("logout")?.click();
  });
  await expect(page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
  await expect(page.getByTestId("login-notice")).toHaveCount(0);
  expect(existsSync(join(userDataDir(), "session.json"))).toBe(false);
  await app.close();
  const again = await launchOnline(backend);
  await expect(again.page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
});

// ---- hand-in with tests (T20) ----

const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

async function testSummeGreen(page: Page): Promise<void> {
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Dein Code sieht richtig aus!");
}

test("after a green test run, Abgeben asks nothing and sends the test summary", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await setEditorText(app, page, SUMME_RIGHT);
  await testSummeGreen(page);
  await page.getByTestId("hand-in").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await expect(page.getByTestId("hand-in-dialog")).toHaveCount(0);
  expect(await backend.handInCell("summe")).toMatchObject({ count: 1, testSummary: { passed: 3, total: 3 } });
});

test("editing after a green run brings the dialog; confirming hands in without a summary", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await setEditorText(app, page, SUMME_RIGHT);
  await testSummeGreen(page);
  await setEditorText(app, page, SUMME_RIGHT + "// geändert\n");
  await page.getByTestId("hand-in").click();
  const dialog = page.getByTestId("hand-in-dialog");
  await expect(dialog).toContainText("Du hast deinen Code seit dem letzten Testen geändert. Teste noch einmal, bevor du abgibst.");
  await expect(dialog.getByTestId("hand-in-dialog-count")).toHaveCount(0); // the green run no longer applies
  await screenshot(page, { path: join(screenshotDir, "handin-dialog.png") });
  expect(await backend.handInCell("summe")).toBeNull();
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await expect(dialog).toHaveCount(0);
  expect(await backend.handInCell("summe")).toMatchObject({ count: 1, testSummary: null });
});

test("Weiterarbeiten cancels: no hand-in", async () => {
  const backend = await startBackend();
  const { page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await page.getByTestId("hand-in").click(); // never tested
  await expect(page.getByTestId("hand-in-dialog")).toBeVisible();
  await page.getByTestId("hand-in-cancel").click();
  await expect(page.getByTestId("hand-in-dialog")).toHaveCount(0);
  await expect(page.getByTestId("hand-in")).toHaveText("Abgeben");
  await expect(page.getByTestId("toast")).toHaveCount(0);
  expect(await backend.handInCell("summe")).toBeNull();
});

test("a failed run on unchanged code: the dialog shows the count and the summary is sent on confirm", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await setEditorText(app, page, SUMME_RIGHT.replace("a + b", "a - b"));
  await page.getByTestId("test").click();
  await expect(page.getByTestId("tests-banner")).toContainText("Da sind noch Fehler");
  await page.getByTestId("hand-in").click();
  await expect(page.getByTestId("hand-in-dialog-count")).toHaveText("1 von 3 Tests bestanden");
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  expect(await backend.handInCell("summe")).toMatchObject({ testSummary: { passed: 1, total: 3 } });
});

// ---- graded exercises (M8, T48) ----

const SOLUTION = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;
const DRAFT = 'void main() {\n    IO.println("NEUER-ENTWURF");\n}\n';
const FEEDBACK = "Gut gelöst. Achte noch auf die Namen der Variablen.";

/** Hands in the (correct) solution, keeps working on a different draft and lets the teacher grade the hand-in. */
async function gradedSumme(backend: Backend, symbol: "PLUS" | "PLUS_WELLE" | "MINUS" = "PLUS_WELLE") {
  const l = await loggedIn(backend);
  await openExercise(l.page, SUMME);
  await setEditorText(l.app, l.page, SOLUTION);
  await handIn(l.page);
  await expect(l.page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await setEditorText(l.app, l.page, DRAFT);
  await expect(l.page.getByTestId("save-status")).toHaveText("Gespeichert");
  await backend.grade({
    exerciseId: "summe",
    symbol,
    comment: FEEDBACK,
    lineComments: [
      { path: "Summe.java", line: 2, text: "Gute Idee mit dem Scanner." },
      { path: "Summe.java", line: 99, text: "Dieser Kommentar gehört ans Ende." }
    ]
  });
  await l.page.getByRole("button", { name: "← Aufgaben" }).click();
  return l;
}

test("a graded exercise shows the grade chip, Beurteilt am and Ansehen on its card", async () => {
  const backend = await startBackend();
  const { page } = await gradedSumme(backend);
  const c = card(page, SUMME);
  await expect(c.getByTestId("grade-chip")).toHaveText(/Beurteilt\s+\+~/);
  await expect(c.getByTestId("grade-chip")).toHaveAttribute("data-symbol", "PLUS_WELLE");
  await expect(c.getByTestId("grade-subtitle")).toHaveText(/^Beurteilt am \w\w, \d+\.\d+\.$/);
  await expect(c).not.toContainText("Abgegeben");
  await expect(c.getByRole("button", { name: "Ansehen" })).toBeVisible();
  await expect(card(page, "Größere Zahl").getByTestId("grade-chip")).toHaveCount(0);
  await screenshot(page, { path: join(screenshotDir, "online-graded-list.png") });
});

test("opening a graded exercise: graded files read-only, Rückmeldung, line comments, no run / test / hand-in", async () => {
  const backend = await startBackend();
  const { page } = await gradedSumme(backend);
  await openExercise(page, SUMME);

  // header
  await expect(page.getByTestId("grade-chip")).toHaveText(/Beurteilt\s+\+~/);
  await expect(page.getByTestId("graded-status")).toHaveText(/^Abgegeben: \w\w, \d+\.\d+\. um \d\d:\d\d · nur lesen$/);
  await expect(page.getByTestId("copy-to-scratch")).toHaveText("In Scratch kopieren …");
  for (const id of ["run", "stop", "test", "hand-in"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toHaveCount(0);
  // no Konsole / Probleme panel, no "Neue Klasse"
  await expect(page.getByRole("button", { name: /Konsole/ })).toHaveCount(0);
  await expect(page.getByTestId("bottom-handle")).toHaveCount(0);
  await expect(page.getByTestId("add-class")).toHaveCount(0);

  // the graded hand-in, not the local draft
  const lines = page.locator(".monaco-editor .view-lines");
  await expect(lines).toContainText("Scanner sc");
  await expect(lines).not.toContainText("NEUER-ENTWURF");

  // Rückmeldung above the code
  await expect(page.getByTestId("feedback")).toContainText("Rückmeldung");
  await expect(page.getByTestId("feedback")).toContainText(/beurteilt am \w\w, \d+\.\d+\./);
  await expect(page.getByTestId("feedback-text")).toHaveText(FEEDBACK);

  // line comments as boxes in the code; the one beyond the end follows the last line
  const comments = page.getByTestId("line-comment");
  await expect(comments).toHaveCount(2);
  await expect(comments.nth(0)).toContainText("Gute Idee mit dem Scanner.");
  await expect(comments.nth(1)).toContainText("Dieser Kommentar gehört ans Ende.");
  const line2 = await page.locator(".monaco-editor .view-line").filter({ hasText: "Scanner sc" }).boundingBox();
  const line3 = await page.locator(".monaco-editor .view-line").filter({ hasText: "int a = sc.nextInt();" }).boundingBox();
  const first = await comments.nth(0).boundingBox();
  const last = await comments.nth(1).boundingBox();
  const closing = await page.locator(".monaco-editor .view-line").filter({ hasText: /^}$/ }).boundingBox();
  expect(first!.y).toBeGreaterThanOrEqual(line2!.y + line2!.height - 1); // directly below line 2 ...
  expect(first!.y).toBeLessThan(line3!.y + 1); // ... and line 3 is pushed down below the box
  expect(last!.y).toBeGreaterThan(closing!.y); // after the last line
  await expect(page.getByTestId("file-comments")).toHaveText("💬 2");
  await screenshot(page, { path: join(screenshotDir, "online-graded-workspace.png") });

  // read-only: typing changes nothing
  await lines.click();
  await page.keyboard.type("XYZ");
  await expect(lines).not.toContainText("XYZ");
});

test("a minus grade is shown with the real minus sign and the red chip", async () => {
  const backend = await startBackend();
  const { page } = await gradedSumme(backend, "MINUS");
  await expect(card(page, SUMME).getByTestId("grade-symbol")).toHaveText("\u2212");
  await expect(card(page, SUMME).getByTestId("grade-chip")).toHaveClass(/bad/);
});

test("In Scratch kopieren from a graded exercise: Mit meinem Code copies the graded code, Neu beginnen the starter", async () => {
  const backend = await startBackend();
  const { page } = await gradedSumme(backend);
  await openExercise(page, SUMME);
  await page.getByTestId("copy-to-scratch").click();
  await expect(page.getByTestId("copy-mine")).toBeChecked();
  await page.getByTestId("copy-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("In Scratch kopiert");
  await expect(page.getByTestId("copy-dialog")).toHaveCount(0);
  await page.getByTestId("copy-to-scratch").click();
  await page.getByTestId("copy-fresh").check();
  await page.getByTestId("copy-confirm").click();
  await expect(page.getByTestId("copy-dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "← Aufgaben" }).click();

  const items = page.getByTestId("scratch-item").filter({ hasText: SUMME });
  await expect(items).toHaveCount(2);
  const results: string[] = [];
  for (const n of [0, 1]) {
    await items.nth(n).getByTestId("scratch-open").click();
    await expect(page.getByTestId("hand-in")).toHaveCount(0);
    const text = await page.locator(".monaco-editor .view-lines").innerText();
    expect(text).not.toContain("NEUER-ENTWURF"); // never the local draft
    await page.getByTestId("test").click();
    await expect(page.getByTestId("tests-banner")).toBeVisible();
    results.push((await page.getByTestId("tests-banner").innerText()).includes("3 von 3 Tests bestanden") ? "graded" : "starter");
    await page.getByRole("button", { name: "← Aufgaben" }).click();
  }
  expect(results.sort()).toEqual(["graded", "starter"]);
});

test("a hand-in answered with GRADED shows the server message and the list shows the grade afterwards", async () => {
  const backend = await startBackend();
  const { page } = await loggedIn(backend);
  await openExercise(page, SUMME);
  await handIn(page);
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  // graded while the exercise is open
  await backend.grade({ exerciseId: "summe", symbol: "WELLE", comment: "", lineComments: [] });
  await handIn(page);
  await expect(page.getByTestId("toast")).toContainText("Diese Aufgabe ist bereits beurteilt. Du kannst sie nicht mehr abgeben.");
  await screenshot(page, { path: join(screenshotDir, "online-graded-409.png") });
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(card(page, SUMME).getByTestId("grade-chip")).toHaveText(/Beurteilt\s+~/);
  // an empty overall comment: no Rückmeldung box
  await openExercise(page, SUMME);
  await expect(page.getByTestId("grade-chip")).toBeVisible();
  await expect(page.getByTestId("feedback")).toHaveCount(0);
  await expect(page.getByTestId("line-comment")).toHaveCount(0);
  await expect(page.getByTestId("file-comments")).toHaveCount(0);
});

test("offline: a graded exercise seen before opens from the cache", async () => {
  const backend = await startBackend();
  const first = await gradedSumme(backend);
  await openExercise(first.page, SUMME); // caches the grade
  await first.page.getByRole("button", { name: "← Aufgaben" }).click();
  await first.app.close();
  await backend.stop();

  const { page } = await launchOnline(backend);
  await expect(page.getByTestId("offline-hint")).toBeVisible();
  await expect(card(page, SUMME).getByTestId("grade-chip")).toHaveText(/Beurteilt\s+\+~/);
  await openExercise(page, SUMME);
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("Scanner sc");
  await expect(page.getByTestId("feedback-text")).toHaveText(FEEDBACK);
  await expect(page.getByTestId("line-comment")).toHaveCount(2);
});

test("offline: a graded exercise that was never opened cannot be shown and says so", async () => {
  const backend = await startBackend();
  const first = await gradedSumme(backend); // back on the list: the grade is in the cached list, the grade itself is not
  await expect(card(first.page, SUMME).getByTestId("grade-chip")).toBeVisible();
  await first.app.close();
  await backend.stop();

  const { page } = await launchOnline(backend);
  await expect(card(page, SUMME).getByTestId("grade-chip")).toBeVisible();
  await card(page, SUMME).getByRole("button", { name: "Ansehen" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Die Beurteilung ist gerade nicht verfügbar. Verbinde dich mit dem Internet und versuche es noch einmal."
  );
  await expect(page.getByTestId("exercise").first()).toBeVisible(); // still on the list
});
