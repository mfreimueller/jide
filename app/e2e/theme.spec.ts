import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, newUserData, openExercise, useTempApp, userDataDir } from "./helpers";

useTempApp();

type Choice = "light" | "dark" | "system";

/** Playwright pins every page to light; let the page see what the app (nativeTheme) says. */
async function followApp(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: null });
}

const prefersDark = (page: Page) => page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
const background = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);

/** Clicks Ansicht > Darstellung > <choice> like a student would. */
async function choose(app: ElectronApplication, choice: Choice): Promise<void> {
  await app.evaluate(({ Menu }, c) => {
    Menu.getApplicationMenu()!.getMenuItemById(`theme-${c}`)!.click();
  }, choice);
}

const checked = (app: ElectronApplication) =>
  app.evaluate(({ Menu }) =>
    ["light", "dark", "system"].filter((c) => Menu.getApplicationMenu()!.getMenuItemById(`theme-${c}`)!.checked)
  );

const osDark = (app: ElectronApplication) => app.evaluate(({ nativeTheme }) => nativeTheme.shouldUseDarkColors);

test("Dunkel / Hell / System switch the whole app, the choice is remembered", async () => {
  const { app, page } = await launch();
  await followApp(page);
  await openExercise(page, "Summe zweier Zahlen");

  // default: System, follows the OS
  expect(await checked(app)).toEqual(["system"]);
  expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("system");
  expect(await prefersDark(page)).toBe(await osDark(app));

  await choose(app, "dark");
  await expect.poll(() => prefersDark(page)).toBe(true);
  expect(await checked(app)).toEqual(["dark"]);
  expect(await background(page, "body")).toBe("rgb(17, 17, 19)"); // #111113
  expect(await background(page, '[data-testid="assignment"]')).toBe("rgb(24, 25, 27)"); // #18191b
  // Monaco follows live and so does the console
  await expect.poll(() => background(page, ".monaco-editor-background")).toBe("rgb(24, 25, 27)");
  await expect.poll(() => background(page, ".xterm-scrollable-element")).toBe("rgb(11, 12, 14)"); // #0b0c0e

  await choose(app, "light");
  await expect.poll(() => prefersDark(page)).toBe(false);
  expect(await background(page, "body")).toBe("rgb(248, 249, 250)");
  await expect.poll(() => background(page, ".monaco-editor-background")).toBe("rgb(255, 255, 255)");
  await expect.poll(() => background(page, ".xterm-scrollable-element")).toBe("rgb(28, 32, 36)"); // #1c2024

  await choose(app, "system");
  await expect.poll(() => prefersDark(page)).toBe(await osDark(app));
  expect(await checked(app)).toEqual(["system"]);
  expect(JSON.parse(readFileSync(join(userDataDir(), "settings.json"), "utf8"))).toEqual({ theme: "system" });
});

test("the choice survives a restart (same user data folder), also System", async () => {
  const ud = newUserData();
  const first = await launch({}, ud);
  await choose(first.app, "dark");
  await first.app.evaluate(({ app }) => app.exit(0));

  const second = await launch({}, ud);
  await followApp(second.page);
  expect(await second.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("dark");
  expect(await checked(second.app)).toEqual(["dark"]);
  await expect.poll(() => prefersDark(second.page)).toBe(true);
  expect(await background(second.page, "body")).toBe("rgb(17, 17, 19)");
  expect(JSON.parse(readFileSync(join(ud, "settings.json"), "utf8"))).toEqual({ theme: "dark" });

  await choose(second.app, "light");
  await second.app.evaluate(({ app }) => app.exit(0));
  const third = await launch({}, ud);
  await followApp(third.page);
  expect(await third.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe("light");
  await expect.poll(() => prefersDark(third.page)).toBe(false);
});

test("an unreadable settings file means System", async () => {
  const ud = newUserData();
  writeFileSync(join(ud, "settings.json"), "{ not json");
  const { app, page } = await launch({}, ud);
  await followApp(page);
  expect(await checked(app)).toEqual(["system"]);
  expect(await prefersDark(page)).toBe(await osDark(app));
});

test("the menu: View is Ansicht with Darstellung, Abmelden only online", async () => {
  const local = await launch();
  const labels = await local.app.evaluate(({ Menu }) => {
    const ansicht = Menu.getApplicationMenu()!.getMenuItemById("ansicht")!;
    const darstellung = Menu.getApplicationMenu()!.getMenuItemById("darstellung")!;
    return {
      ansicht: ansicht.label,
      view: ansicht.submenu!.items.map((i) => i.role ?? i.type),
      darstellung: darstellung.submenu!.items.map((i) => `${i.label}:${i.type}`),
      logout: Menu.getApplicationMenu()!.getMenuItemById("logout")
    };
  });
  expect(labels.ansicht).toBe("Ansicht");
  expect(labels.view.at(-1)).toBe("submenu");
  expect(labels.darstellung).toEqual(["Hell:radio", "Dunkel:radio", "System:radio"]);
  expect(labels.logout).toBeNull();

  // online (the backend does not have to answer: the login screen is enough)
  const online = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: "http://127.0.0.1:1" }, newUserData());
  expect(await online.app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById("logout")?.label)).toBe("Abmelden…");
  expect(await online.app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById("theme-dark")?.label)).toBe("Dunkel");
});

test("exam mode has Darstellung too; the choice is stored outside the exam folder, no Abmelden", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-theme-"));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await followApp(page);
  expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById("ansicht")!.label)).toBe("Ansicht");
  expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById("logout"))).toBeNull();

  await choose(app, "dark");
  await expect.poll(() => prefersDark(page)).toBe(true);
  await expect(page.getByTestId("exam-start")).toBeVisible();
  expect(await background(page, "body")).toBe("rgb(17, 17, 19)");
  expect(await background(page, '[data-testid="exam-bar"]')).toBe("rgb(11, 12, 14)"); // #0b0c0e

  // userData is below the temp folder in exam mode, never in the exam folder
  const userData = await app.evaluate(({ app: a }) => a.getPath("userData"));
  expect(userData.startsWith(examDir)).toBe(false);
  expect(existsSync(join(examDir, "settings.json"))).toBe(false);
  expect(JSON.parse(readFileSync(join(userData, "settings.json"), "utf8"))).toEqual({ theme: "dark" });
  await app.evaluate(({ app: a }) => a.exit(0));
});
