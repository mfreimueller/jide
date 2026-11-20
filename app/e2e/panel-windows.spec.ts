import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, newUserData, openExercise, setEditorText, useTempApp, userDataDir } from "./helpers";

useTempApp();

const TITLE = "Summe zweier Zahlen";
type Panel = "code" | "assign" | "console" | "problems" | "tests";
const LABEL: Record<Panel, string> = { code: "Code", assign: "Angabe", console: "Konsole", problems: "Probleme", tests: "Tests" };

const SUMME = `void main() {
    Scanner sc = new Scanner(System.in);
    IO.print("Erste Zahl: ");
    int a = sc.nextInt();
    IO.print("Zweite Zahl: ");
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;
const SUMME_RIGHT = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

/** The page of the window of a detached panel (the page URL carries ?panel=...). */
async function panelPage(app: ElectronApplication, panel: Panel): Promise<Page> {
  let found: Page | undefined;
  await expect
    .poll(() => {
      found = app.windows().find((w) => w.url().includes(`panel=${panel}`));
      return found !== undefined;
    })
    .toBe(true);
  const page = found!;
  await page.waitForLoadState("domcontentloaded");
  return page;
}

async function panelWindowCount(app: ElectronApplication): Promise<number> {
  return app.windows().filter((w) => !w.isClosed() && w.url().includes("panel=")).length;
}

function nativeTitles(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.getTitle()));
}

async function focusedTitle(app: ElectronApplication): Promise<string | undefined> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.getTitle());
}

/** Detaches a panel with its ⧉ button in the main window. */
async function detach(page: Page, panel: Panel): Promise<void> {
  if (panel === "code") await page.getByTestId("detach-code").click();
  else if (panel === "assign") await page.getByTestId("detach-assign").click();
  else {
    await page.getByTestId(`btab-${LABEL[panel]}`).click();
    await page.getByTestId("detach-bottom").click();
  }
}

/** Closes a panel window like the OS close button does. */
async function osClose(app: ElectronApplication, panel: Panel): Promise<void> {
  await app.evaluate(({ BrowserWindow }, label) => {
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle().startsWith(`J;DE – ${label} –`))
      ?.close();
  }, LABEL[panel]);
}

function mainPanelVisible(page: Page, panel: Panel) {
  switch (panel) {
    case "code":
      return page.getByTestId("tabs");
    case "assign":
      return page.getByTestId("assignment");
    default:
      return page.getByTestId(`btab-${LABEL[panel]}`);
  }
}

for (const panel of ["code", "assign", "console", "problems", "tests"] as const) {
  test(`${LABEL[panel]}: detach with the button, chip, dock back with the button`, async () => {
    const { app, page } = await launch();
    await openExercise(page, TITLE);
    await expect(page.getByTestId("detach-code")).toHaveAttribute("aria-label", "Code in eigenem Fenster öffnen");
    await detach(page, panel);
    const win = await panelPage(app, panel);
    expect(await nativeTitles(app)).toContain(`J;DE – ${LABEL[panel]} – ${TITLE}`);
    await expect(mainPanelVisible(page, panel)).toHaveCount(0);
    const chip = page.getByTestId(`panel-chip-${panel}`);
    await expect(chip).toHaveText(LABEL[panel]);
    await expect(chip).toHaveAttribute(
      "data-tip",
      `${LABEL[panel]} ist in einem eigenen Fenster – Klick holt es nach vorne. Schließen holt es zurück.`
    );
    // a click on the chip brings the window to the front
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "J;DE")?.focus());
    await expect.poll(() => focusedTitle(app)).toBe("J;DE");
    await chip.click();
    await expect.poll(() => focusedTitle(app)).toBe(`J;DE – ${LABEL[panel]} – ${TITLE}`);

    await win.getByTestId("panel-back").click();
    await expect.poll(() => panelWindowCount(app)).toBe(0);
    await expect(chip).toHaveCount(0);
    await expect(mainPanelVisible(page, panel)).toBeVisible();
  });

  test(`${LABEL[panel]}: closing the window (OS) docks it back`, async () => {
    const { app, page } = await launch();
    await openExercise(page, TITLE);
    await detach(page, panel);
    await panelPage(app, panel);
    await expect(page.getByTestId(`panel-chip-${panel}`)).toBeVisible();
    await osClose(app, panel);
    await expect.poll(() => panelWindowCount(app)).toBe(0);
    await expect(page.getByTestId(`panel-chip-${panel}`)).toHaveCount(0);
    await expect(mainPanelVisible(page, panel)).toBeVisible();
  });
}

test("detached bottom tabs leave the bottom panel; with all three gone it disappears", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "console");
  await panelPage(app, "console");
  await expect(page.getByTestId("btab-Konsole")).toHaveCount(0);
  await expect(page.getByTestId("btab-Probleme")).toBeVisible();
  await expect(page.getByTestId("btab-Probleme")).toHaveClass(/active/);
  await detach(page, "problems");
  await detach(page, "tests");
  await panelPage(app, "tests");
  await expect.poll(() => panelWindowCount(app)).toBe(3);
  await expect(page.locator(".btabs")).not.toBeVisible();
  // docking one brings the panel back
  await (await panelPage(app, "problems")).getByTestId("panel-back").click();
  await expect(page.getByTestId("btab-Probleme")).toBeVisible();
});

test("Code detached: Dateien and the bottom panel stay in the main window, Angabe too", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "code");
  await panelPage(app, "code");
  await expect(page.getByTestId("file-list")).toBeVisible();
  await expect(page.getByTestId("assignment")).toBeVisible();
  await expect(page.getByTestId("btab-Konsole")).toBeVisible();
  await expect(page.locator(".monaco-editor")).toHaveCount(0);
  await expect(page.getByTestId("run")).toBeVisible();
});

test("leaving the exercise closes all windows; so does opening another one", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "assign");
  await detach(page, "code");
  await panelPage(app, "code");
  await expect.poll(() => panelWindowCount(app)).toBe(2);
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect.poll(() => panelWindowCount(app)).toBe(0);
  // docked again: the next exercise starts with everything in the main window
  await openExercise(page, "Größere Zahl");
  await expect(page.getByTestId("assignment")).toBeVisible();
  await expect(page.getByTestId("panel-chip-assign")).toHaveCount(0);
});

test("a window reopens where it was within the session", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "assign");
  const win = await panelPage(app, "assign");
  const move = async (): Promise<void> =>
    app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((w) => w.getTitle().startsWith("J;DE – Angabe"))?.setBounds({ x: 120, y: 90, width: 500, height: 600 });
    });
  await move();
  await win.getByTestId("panel-back").click();
  await expect.poll(() => panelWindowCount(app)).toBe(0);
  await detach(page, "assign");
  await panelPage(app, "assign");
  const bounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle().startsWith("J;DE – Angabe"))?.getBounds());
  expect(bounds).toMatchObject({ width: 500, height: 600 });
});

test("Ausführen in the Code window: output in a detached Konsole, input goes to the program", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "console");
  const konsole = await panelPage(app, "console");
  await detach(page, "code");
  const code = await panelPage(app, "code");
  await expect(code.locator(".monaco-editor .view-lines")).toBeVisible();
  await setEditorText(app, code, SUMME);
  await expect(code.getByTestId("save-status")).toHaveText("Gespeichert");
  await code.getByTestId("run").click();
  const out = konsole.getByTestId("console").locator(".xterm-rows");
  await expect(out).toContainText("▶ Summe.java wird ausgeführt …");
  await expect(out).toContainText("Erste Zahl:");
  await expect(code.getByTestId("run")).toBeDisabled();
  await expect(code.getByTestId("stop")).toBeEnabled();
  await expect(page.getByTestId("run")).toBeDisabled();
  // typed into the detached Konsole
  await konsole.keyboard.type("3");
  await konsole.keyboard.press("Enter");
  await expect(out).toContainText("Zweite Zahl:");
  await konsole.keyboard.type("4");
  await konsole.keyboard.press("Enter");
  await expect(out).toContainText("Summe: 7");
  await expect(out).toContainText("■ Programm beendet.");
  await expect(code.getByTestId("run")).toBeEnabled();
  // docking the Konsole back: the main window's console has the whole history including what was typed
  await konsole.getByTestId("panel-back").click();
  await expect.poll(() => panelWindowCount(app)).toBe(1);
  const mainOut = page.getByTestId("console").locator(".xterm-rows");
  await expect(mainOut).toContainText("Summe: 7");
  await expect(mainOut).toContainText("Erste Zahl: 3");
  // Leeren in the main window works as ever
  await page.getByTestId("clear-console").click();
  await expect(mainOut).not.toContainText("Summe: 7");
});

test("Stopp in the Code window ends the program", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "code");
  const code = await panelPage(app, "code");
  await setEditorText(app, code, "void main() {\n    while (true) {}\n}\n");
  await code.getByTestId("run").click();
  await expect(code.getByTestId("stop")).toBeEnabled();
  await code.getByTestId("stop").click();
  await expect(code.getByTestId("run")).toBeEnabled();
  await expect(page.getByTestId("console").locator(".xterm-rows")).toContainText("■ Programm wurde gestoppt.");
});

test("Tests detached: Testen shows the results in the Tests window, from the main and from the Code window", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await setEditorText(app, page, SUMME_RIGHT);
  await detach(page, "tests");
  const tests = await panelPage(app, "tests");
  await expect(tests.getByText("Noch nicht getestet.")).toBeVisible();
  await page.getByTestId("test").click();
  await expect(tests.getByTestId("tests-banner")).toContainText("Dein Code sieht richtig aus!");
  await expect(tests.getByTestId("tests-banner")).toContainText("3 von 3 Tests bestanden");
  await expect(tests.getByTestId("window-badge")).toHaveText("3/3");
  await expect(tests.getByTestId("test-row")).toHaveCount(3);
  // from the Code window
  await detach(page, "code");
  const code = await panelPage(app, "code");
  await setEditorText(app, code, SUMME_RIGHT.replace("a + b", "a - b"));
  await expect(tests.getByTestId("tests-stale")).toBeVisible();
  await code.getByTestId("test").click();
  await expect(tests.getByTestId("tests-banner")).toContainText("Da sind noch Fehler in deinem Programm.");
  await expect(tests.getByTestId("tests-stale")).toHaveCount(0);
});

test("Probleme detached: compile errors show there, a click opens the line in the Code window", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "problems");
  const problems = await panelPage(app, "problems");
  await detach(page, "code");
  const code = await panelPage(app, "code");
  await setEditorText(app, code, "void main() {\n    int a = ;\n}\n");
  await expect(problems.getByTestId("problem").first()).toBeVisible();
  await expect(code.locator(".squiggly-error").first()).toBeVisible();
  await problems.getByTestId("problem").first().click();
  await expect.poll(() => focusedTitle(app)).toBe(`J;DE – Code – ${TITLE}`);
});

test("one live editor: edits in the Code window are saved by the main window and survive docking back", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "code");
  const code = await panelPage(app, "code");
  await setEditorText(app, code, "void main() {\n    IO.println(\"Hallo aus dem Fenster\");\n}\n");
  await expect(code.getByTestId("save-status")).toHaveText("Gespeichert");
  const saved = readFileSync(join(userDataDir(), "workspaces", "summe", "Summe.java"), "utf8");
  expect(saved).toContain("Hallo aus dem Fenster");
  await code.getByTestId("panel-back").click();
  await expect.poll(() => panelWindowCount(app)).toBe(0);
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("Hallo aus dem Fenster");
  // and editing in the main window again works
  await setEditorText(app, page, "void main() {\n    IO.println(\"wieder im Hauptfenster\");\n}\n");
  await expect(page.getByTestId("save-status")).toHaveText("Gespeichert");
  expect(readFileSync(join(userDataDir(), "workspaces", "summe", "Summe.java"), "utf8")).toContain("wieder im Hauptfenster");
});

test("a click in Dateien opens the file in the Code window and brings it to the front", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jide-two-"));
  cpSync(join(examplesDir, "summe"), join(dir, "summe"), { recursive: true });
  const two = join(dir, "zwei");
  mkdirSync(join(two, "files"), { recursive: true });
  writeFileSync(join(two, "exercise.yaml"), 'id: zwei\ntitle: "Zwei Dateien"\nfiles:\n  - path: Main.java\n    editable: true\n  - path: Hilfe.java\n    editable: true\nmainFile: Main.java\n');
  writeFileSync(join(two, "aufgabe.md"), "Zwei Dateien.\n");
  writeFileSync(join(two, "files", "Main.java"), "void main() {\n}\n");
  writeFileSync(join(two, "files", "Hilfe.java"), "class Hilfe {}\n");
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: dir });
  await openExercise(page, "Zwei Dateien");
  await detach(page, "code");
  const code = await panelPage(app, "code");
  await expect(code.getByTestId("tabs").getByRole("button", { name: "Main.java" })).toBeVisible();
  await page.getByTestId("file-list").getByRole("button", { name: /Hilfe\.java/ }).click();
  await expect(code.getByTestId("tabs").getByRole("button", { name: "Hilfe.java" })).toHaveClass(/active/);
  await expect(code.locator(".monaco-editor .view-lines")).toContainText("class Hilfe");
  await expect.poll(() => focusedTitle(app)).toBe("J;DE – Code – Zwei Dateien");
});

test("dark mode: a detached window follows the theme", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "assign");
  const win = await panelPage(app, "assign");
  await win.emulateMedia({ colorScheme: null });
  await page.emulateMedia({ colorScheme: null });
  const bg = (p: Page): Promise<string> => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await app.evaluate(({ nativeTheme }) => (nativeTheme.themeSource = "light"));
  await expect.poll(() => win.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(false);
  const light = await bg(win);
  await app.evaluate(({ nativeTheme }) => (nativeTheme.themeSource = "dark"));
  await expect.poll(() => win.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
  const dark = await bg(win);
  expect(dark).not.toBe(light);
  expect(dark).toBe(await bg(page));
});

test("security: panel windows use the same webPreferences as the main window", async () => {
  const { app, page } = await launch();
  await openExercise(page, TITLE);
  await detach(page, "assign");
  await panelPage(app, "assign");
  const prefs = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => {
      const p = (w.webContents as unknown as { getLastWebPreferences(): Record<string, unknown> }).getLastWebPreferences();
      return { contextIsolation: p["contextIsolation"], sandbox: p["sandbox"], nodeIntegration: p["nodeIntegration"] };
    })
  );
  expect(prefs).toHaveLength(2);
  for (const p of prefs) expect(p).toEqual({ contextIsolation: true, sandbox: true, nodeIntegration: false });
});

test("exam mode: no ⧉ buttons, no chips, no panel windows", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir, JIDE_USER_DATA_DIR: newUserData() });
  await page.getByLabel("Vor- und Nachname").fill("Max Muster");
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="tabs"]:visible')).toBeVisible();
  for (const id of ["detach-code", "detach-assign", "detach-bottom"]) await expect(page.getByTestId(id)).toHaveCount(0);
  // main refuses even if the renderer asked
  const opened = await page.evaluate(() => window.jide.panels.detach("assign"));
  expect(opened).toBe(false);
  expect(await panelWindowCount(app)).toBe(0);
});
