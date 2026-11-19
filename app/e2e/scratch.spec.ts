import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { launch, screenshotDir, setEditorText, userDataDir, useTempApp } from "./helpers";
import { dbReachable, login, startBackend, stopAllBackends, type Backend } from "./online-helpers";

useTempApp();
test.afterEach(stopAllBackends);

const MAIN = 'void main() {\n    IO.println("SCRATCH-HALLO");\n}\n';

/** Online mode with a server that is never asked: before login nothing may call it. */
function launchBeforeLogin() {
  return launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: "http://127.0.0.1:9" });
}

async function createProgram(page: Page, name: string): Promise<void> {
  await page.getByTestId("scratch-new").click();
  const dialog = page.getByTestId("scratch-dialog");
  await expect(dialog.getByRole("heading", { name: "Neues Programm" })).toBeVisible();
  await expect(dialog).toContainText("Es startet mit der Datei Main.java");
  await expect(page.getByTestId("text-dialog-confirm")).toBeDisabled();
  await expect(page.getByTestId("text-dialog-input")).toBeFocused();
  await page.getByTestId("text-dialog-input").fill(name);
  await page.keyboard.press("Enter");
  await expect(page.locator(".monaco-editor .view-lines")).toBeVisible();
}

function item(page: Page, title: string) {
  return page.getByTestId("scratch-item").filter({ hasText: title });
}

test("before login: create, add a class, run, pick an Angabe, rename and delete a Scratch program", async () => {
  const { app, page } = await launchBeforeLogin();
  await expect(page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
  await expect(page.getByText("In Scratch schreibst du eigene Programme.")).toBeVisible();
  await page.screenshot({ path: join(screenshotDir, "scratch-code-screen.png") });
  await page.getByTestId("open-scratch").click();

  // Scratch-only list: own title, no course / connection / user, a button back to the code screen
  await expect(page.locator(".topbar .title")).toHaveText("Scratch");
  await expect(page.getByTestId("course")).toHaveCount(0);
  await expect(page.getByTestId("sync")).toHaveCount(0);
  await expect(page.getByTestId("student")).toHaveCount(0);
  await expect(page.getByTestId("scratch-heading")).toContainText("Nur auf diesem Laptop gespeichert");
  await expect(page.getByTestId("scratch-empty")).toHaveText("Noch keine eigenen Programme.");
  await expect(page.getByTestId("load-errors")).toHaveCount(0);
  await page.screenshot({ path: join(screenshotDir, "scratch-list-empty.png") });

  await createProgram(page, "Mein Rechner");
  await expect(page.locator(".topbar .title")).toHaveText("Mein Rechner");
  await expect(page.getByTestId("scratch-chip")).toHaveText("Scratch");
  await expect(page.getByTestId("file-list")).toContainText("Main.java");
  await expect(page.getByTestId("hand-in")).toHaveCount(0);
  await expect(page.getByTestId("test")).toHaveCount(0);
  await expect(page.getByTestId("run")).toBeVisible();
  await expect(page.getByTestId("delete-class")).toHaveCount(0); // Main.java is never deletable

  // empty Angabe
  await expect(page.getByTestId("assign-empty")).toContainText("Noch keine Angabe");
  await expect(page.getByTestId("assign-empty")).toContainText("Du kannst eine Markdown-Datei (.md) als Angabe dazugeben.");
  await page.screenshot({ path: join(screenshotDir, "scratch-workspace.png") });

  // add a class: errors stay in the dialog
  await page.getByTestId("add-class").click();
  await expect(page.getByTestId("class-dialog").getByRole("heading", { name: "Neue Klasse" })).toBeVisible();
  await page.getByTestId("text-dialog-input").fill("class");
  await page.getByTestId("text-dialog-confirm").click();
  await expect(page.getByTestId("text-dialog-error")).toContainText("reserviertes Wort");
  await page.getByTestId("text-dialog-input").fill("Rechner");
  await page.getByTestId("text-dialog-confirm").click();
  await expect(page.getByTestId("class-dialog")).toHaveCount(0);
  await expect(page.getByTestId("file-list")).toContainText("Rechner.java");
  await expect(page.getByTestId("tabs")).toContainText("Rechner.java");
  await expect(page.getByTestId("delete-class")).toHaveCount(1);

  // run Main.java (always the file that runs)
  await page.getByTestId("file-list").getByRole("button", { name: /^J\s*Main\.java/ }).click();
  await setEditorText(app, page, MAIN);
  await page.getByTestId("run").click();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("SCRATCH-HALLO");
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("■ Programm beendet.");

  // pick an Angabe through the (stubbed) native dialog
  const md = join(userDataDir(), "angabe.md");
  mkdirSync(userDataDir(), { recursive: true });
  writeFileSync(md, "# Rechner bauen\n\nSchreibe einen **Taschenrechner**.\n");
  await stubOpenDialog(app, md);
  await page.getByTestId("assign-pick").click();
  await expect(page.getByTestId("assignment")).toContainText("Rechner bauen");
  await expect(page.getByTestId("assignment")).toContainText("Schreibe einen Taschenrechner.");
  await expect(page.getByTestId("assign-empty")).toHaveCount(0);
  await expect(page.getByTestId("assign-change")).toHaveText("Ändern …");
  await page.screenshot({ path: join(screenshotDir, "scratch-angabe.png") });

  // delete the class after a confirmation
  await page.getByTestId("file-list").getByRole("button", { name: /Rechner\.java/ }).hover();
  await page.getByTestId("delete-class").click();
  await expect(page.getByTestId("class-dialog").getByRole("heading", { name: "„Rechner.java“ löschen?" })).toBeVisible();
  await page.getByTestId("text-dialog-confirm").click();
  await expect(page.getByTestId("file-list")).not.toContainText("Rechner.java");
  await expect(page.getByTestId("tabs")).not.toContainText("Rechner.java");

  // back goes to the Scratch-only list, not to the online list
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.locator(".topbar .title")).toHaveText("Scratch");
  await expect(item(page, "Mein Rechner")).toContainText("Eigenes Programm · 1 Klasse");
  await expect(item(page, "Mein Rechner").locator(".icon")).toHaveText("{ }");
  await expect(item(page, "Mein Rechner")).not.toContainText("Neu");
  await page.screenshot({ path: join(screenshotDir, "scratch-list.png") });

  // rename, open again (Angabe and Main.java survived), delete
  await item(page, "Mein Rechner").getByTestId("scratch-menu").click();
  await page.screenshot({ path: join(screenshotDir, "scratch-menu.png") });
  await page.getByTestId("scratch-rename").click();
  await expect(page.getByTestId("scratch-dialog").getByRole("heading", { name: "Umbenennen" })).toBeVisible();
  await expect(page.getByTestId("text-dialog-input")).toHaveValue("Mein Rechner");
  await page.getByTestId("text-dialog-input").fill("Taschenrechner");
  await page.getByTestId("text-dialog-confirm").click();
  await expect(item(page, "Taschenrechner")).toBeVisible();
  await expect(item(page, "Mein Rechner")).toHaveCount(0);

  await item(page, "Taschenrechner").getByTestId("scratch-open").click();
  await expect(page.getByTestId("assignment")).toContainText("Rechner bauen");
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("SCRATCH-HALLO");
  await page.getByRole("button", { name: "← Aufgaben" }).click();

  await item(page, "Taschenrechner").getByTestId("scratch-menu").click();
  await page.getByTestId("scratch-delete").click();
  await expect(page.getByTestId("scratch-dialog").getByRole("heading", { name: "„Taschenrechner“ löschen?" })).toBeVisible();
  await expect(page.getByTestId("scratch-dialog")).toContainText("Das Programm und alle seine Dateien werden von diesem Laptop gelöscht.");
  await page.screenshot({ path: join(screenshotDir, "scratch-delete.png") });
  await page.keyboard.press("Escape");
  await expect(item(page, "Taschenrechner")).toBeVisible();
  await item(page, "Taschenrechner").getByTestId("scratch-menu").click();
  await page.getByTestId("scratch-delete").click();
  await page.getByTestId("text-dialog-confirm").click();
  await expect(page.getByTestId("scratch-empty")).toBeVisible();

  // back to the code screen
  await page.getByTestId("scratch-login").click();
  await expect(page.getByRole("heading", { name: "Willkommen!" })).toBeVisible();
});

test("after login the Scratch section is the last section; no Abgeben in a Scratch workspace", async () => {
  test.skip(!(await dbReachable()), "MariaDB (docker compose up -d) is not running");
  const backend: Backend = await startBackend();
  const { page } = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url });
  await login(page, backend.code);
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  await expect(page.locator(".topbar .title")).toHaveText("Meine Aufgaben");
  await expect(page.getByTestId("scratch-heading")).toContainText("Deine eigenen Programme – ohne Abgabe");
  await expect(page.getByTestId("scratch-empty")).toBeVisible();

  await createProgram(page, "Nach dem Login");
  await expect(page.getByTestId("hand-in")).toHaveCount(0);
  await page.getByRole("button", { name: "← Aufgaben" }).click();

  // back in the online list (with the connection status), the program below every server exercise
  await expect(page.getByTestId("sync")).toHaveText("Verbunden");
  await expect(item(page, "Nach dem Login")).toContainText("Eigenes Programm · 1 Klasse");
  const lastExercise = await page.getByTestId("exercise").last().boundingBox();
  const heading = await page.getByTestId("scratch-heading").boundingBox();
  const card = await item(page, "Nach dem Login").boundingBox();
  expect(heading!.y).toBeGreaterThan(lastExercise!.y + lastExercise!.height - 1);
  expect(card!.y).toBeGreaterThan(heading!.y);
  // scratch cards never count as exercises
  await expect(page.getByTestId("exercise").filter({ hasText: "Nach dem Login" })).toHaveCount(0);
  await page.screenshot({ path: join(screenshotDir, "scratch-online-list.png") });
});

/** The native file dialog cannot be driven: answer it with `path`. */
async function stubOpenDialog(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as unknown as typeof dialog.showOpenDialog;
  }, path);
}
