import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { card, launch, newUserData, openExercise, screenshotDir, setEditorText, useTempApp, userDataDir } from "./helpers";
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

async function handIn(page: Page): Promise<void> {
  await page.getByTestId("hand-in").click();
}

test("a wrong code stays on the login with the server's message", async () => {
  const backend = await startBackend();
  const { page } = await launchOnline(backend);
  await expect(page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
  await page.screenshot({ path: join(screenshotDir, "online-login.png") });
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
  await page.screenshot({ path: join(screenshotDir, "online-list.png") });
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
  await page.screenshot({ path: join(screenshotDir, "online-handin.png") });

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
  await first.page.screenshot({ path: join(screenshotDir, "online-handin-late.png") });
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
  await page.screenshot({ path: join(screenshotDir, "online-list-offline.png") });

  await openExercise(page, SUMME);
  await setEditorText(app, page, 'void main() {\n    IO.println("OFFLINE-ARBEIT");\n}\n');
  await expect(page.getByTestId("save-status")).toHaveText("Gespeichert");
  await handIn(page);
  await expect(page.getByTestId("toast")).toHaveText(/Keine Verbindung – versuch es gleich nochmal\./);
  await page.screenshot({ path: join(screenshotDir, "online-handin-offline.png") });
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
  await page.screenshot({ path: join(screenshotDir, "online-login-expired.png") });
  // the stored code is gone; the new slip works
  await login(page, newCode);
  await expect(card(page, SUMME)).toBeVisible();
});
