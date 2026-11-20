import { join } from "node:path";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { card, launch, openExercise, setEditorText, useTempApp, userDataDir } from "./helpers";
import { dbReachable, login, startBackend, stopAllBackends, type Backend } from "./online-helpers";

useTempApp();

test.beforeAll(async () => {
  test.skip(!(await dbReachable()), "MariaDB (docker compose up -d) is not running");
});
test.afterEach(stopAllBackends);

const SUMME = "Summe zweier Zahlen"; // open, deadline far in the future
const GROESSER = "Größere Zahl"; // deadline already passed
const CODE = 'void main() {\n    IO.println("X");\n}\n';

async function launchOnline(backend: Backend, userData?: string) {
  return launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url }, userData);
}

async function loggedIn(backend: Backend) {
  const l = await launchOnline(backend);
  await login(l.page, backend.code);
  await expect(card(l.page, SUMME)).toBeVisible();
  return l;
}

async function handIn(app: ElectronApplication, page: Page, title: string): Promise<void> {
  await openExercise(page, title);
  await setEditorText(app, page, CODE);
  await page.getByTestId("hand-in").click();
  await page.getByTestId("hand-in-confirm").click();
  await expect(page.getByTestId("toast")).toContainText("Abgabe gespeichert");
  await page.getByRole("button", { name: "← Aufgaben" }).click();
}

async function hide(page: Page, title: string): Promise<void> {
  await card(page, title).getByTestId("exercise-menu").click();
  await page.getByTestId("exercise-hide").click();
}

test("Ausblenden is disabled with a reason on an open exercise, allowed after the deadline", async () => {
  const backend = await startBackend();
  const { page } = await loggedIn(backend);
  await expect(page.getByTestId("hidden-section")).toHaveCount(0);

  await card(page, SUMME).getByTestId("exercise-menu").click();
  const item = page.getByTestId("exercise-hide");
  await expect(item).toBeDisabled();
  await expect(item).toContainText("Erst nach der Abgabe oder nach der Frist möglich");
  await page.keyboard.press("Escape");

  await card(page, GROESSER).getByTestId("exercise-menu").click();
  await expect(page.getByTestId("exercise-hide")).toBeEnabled();
  await expect(page.getByTestId("exercise-hide")).not.toContainText("Erst nach");
});

test("hide, collapsed bar with count, expand, Wieder anzeigen brings the card back", async () => {
  const backend = await startBackend();
  const { page } = await loggedIn(backend);

  await hide(page, GROESSER);
  await expect(card(page, GROESSER)).toHaveCount(0);
  await expect(page.getByTestId("hidden-count")).toHaveText("1 Aufgabe");
  await expect(page.getByTestId("hidden-toggle")).toHaveText("Anzeigen ▾");
  await expect(page.getByTestId("hidden-exercise")).toHaveCount(0); // collapsed

  await page.getByTestId("hidden-toggle").click();
  await expect(page.getByTestId("hidden-toggle")).toHaveText("Verbergen ▴");
  await expect(page.getByTestId("hidden-section")).toContainText("Beurteilte Aufgaben kommen 7 Tage nach der Beurteilung von selbst hierher.");
  const row = page.getByTestId("hidden-exercise").filter({ hasText: GROESSER });
  await expect(row).toContainText("Weitere Übungen · Frist vorbei");
  await expect(row).toContainText("Frist vorbei · Abgabe noch möglich");
  await expect(row.getByRole("button", { name: "Öffnen" })).toBeVisible();
  await expect(row.getByTestId("exercise-menu")).toHaveCount(0);

  await row.getByTestId("hidden-show").click();
  await expect(card(page, GROESSER)).toBeVisible();
  await expect(page.getByTestId("hidden-section")).toHaveCount(0);
});

test("a handed-in exercise can be hidden, the choice survives a restart and opens from the row", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await handIn(app, page, SUMME);
  await hide(page, SUMME);
  await expect(card(page, SUMME)).toHaveCount(0);
  await app.close();

  const again = await launchOnline(backend, userDataDir());
  await expect(card(again.page, GROESSER)).toBeVisible();
  await expect(card(again.page, SUMME)).toHaveCount(0);
  await expect(again.page.getByTestId("hidden-count")).toHaveText("1 Aufgabe");
  await again.page.getByTestId("hidden-toggle").click();
  const row = again.page.getByTestId("hidden-exercise").filter({ hasText: SUMME });
  await expect(row).toContainText(/abgegeben \w\w, \d+\.\d+\./);
  await expect(row).toContainText("Abgegeben");
  await row.getByRole("button", { name: "Ansehen" }).click();
  await expect(again.page.locator(".monaco-editor .view-lines")).toBeVisible();
});

test("graded more than 7 days ago: hidden by itself; Wieder anzeigen sticks; a fresh grade stays in the list", async () => {
  const backend = await startBackend();
  const { app, page } = await loggedIn(backend);
  await handIn(app, page, SUMME);
  await handIn(app, page, GROESSER);
  await backend.grade({ exerciseId: "summe", symbol: "PLUS_WELLE", comment: "", lineComments: [], gradedDaysAgo: 8 });
  await backend.grade({ exerciseId: "maximum", symbol: "PLUS", comment: "", lineComments: [], gradedDaysAgo: 1 });
  await app.close();

  const l = await launchOnline(backend, userDataDir());
  await expect(card(l.page, GROESSER)).toBeVisible(); // graded yesterday: stays
  await expect(card(l.page, SUMME)).toHaveCount(0);
  await expect(l.page.getByTestId("hidden-count")).toHaveText("1 Aufgabe");
  await l.page.getByTestId("hidden-toggle").click();
  const row = l.page.getByTestId("hidden-exercise").filter({ hasText: SUMME });
  await expect(row).toContainText(/beurteilt \w\w, \d+\.\d+\./);
  await expect(row.getByTestId("grade-chip")).toHaveText(/Beurteilt\s+\+~/);

  await row.getByTestId("hidden-show").click();
  await expect(card(l.page, SUMME)).toBeVisible();
  await l.app.close();

  // the override sticks: after a restart the 8-day-old grade is still in the list
  const third = await launchOnline(backend, userDataDir());
  await expect(card(third.page, SUMME)).toBeVisible();
  await expect(card(third.page, SUMME).getByTestId("grade-chip")).toBeVisible();
});

// Screenshot helper, not a test: with M9_SCREENSHOTS=<dir> it writes the list in light and dark.
test("screenshots", async () => {
  const dir = process.env["M9_SCREENSHOTS"];
  test.skip(!dir, "M9_SCREENSHOTS is not set");
  const backend = await startBackend();
  let cur = await loggedIn(backend);
  const shoot = async (name: string): Promise<void> => {
    const { app, page } = cur;
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: null });
      await app.evaluate(({ nativeTheme }, t) => (nativeTheme.themeSource = t), theme);
      await expect.poll(() => page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(theme === "dark");
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(dir!, `m9-app-${name}-${theme}.png`) });
    }
  };
  // menu on an open exercise: "Ausblenden" disabled with its reason
  await card(cur.page, SUMME).getByTestId("exercise-menu").click();
  await shoot("menu");
  await cur.page.keyboard.press("Escape");

  await handIn(cur.app, cur.page, SUMME);
  await backend.grade({ exerciseId: "summe", symbol: "PLUS_WELLE", comment: "", lineComments: [], gradedDaysAgo: 8 });
  await cur.app.close();
  cur = await launchOnline(backend, userDataDir());
  await expect(card(cur.page, GROESSER)).toBeVisible();
  await shoot("collapsed");
  await cur.page.getByTestId("hidden-toggle").click();
  await shoot("expanded");
});
