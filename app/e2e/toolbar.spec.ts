import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, useTempApp } from "./helpers";

useTempApp();

// TOOLBAR_SHOTS=<dir> also writes screenshots of the tight cases.
const SHOTS = process.env.TOOLBAR_SHOTS;
const dirs: string[] = [];
test.afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Temp copies of the sample exercises under new ids and titles. */
function copies(root: string, count: number, title: (i: number) => string): void {
  for (let i = 1; i <= count; i++) {
    const d = join(root, `a${i}`);
    cpSync(join(examplesDir, i % 2 ? "summe" : "maximum"), d, { recursive: true });
    const y = join(d, "exercise.yaml");
    writeFileSync(y, readFileSync(y, "utf8").replace(/^id: .*$/m, `id: a${i}`).replace(/^title: .*$/m, `title: "${title(i)}"`));
  }
}

async function startExam(count: number): Promise<{ app: ElectronApplication; page: Page }> {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  dirs.push(examDir);
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  copies(join(examDir, "exercises"), count, (i) => `Aufgabe ${i}`);
  const r = await launch({ JIDE_EXAM_DIR: examDir });
  await r.page.getByLabel("Vor- und Nachname").fill("Max Muster");
  await r.page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(r.page.locator('[data-testid="exam-tabs"]:visible')).toBeVisible();
  await r.page.setViewportSize({ width: 1024, height: 700 });
  return r;
}

const zoom = async (app: ElectronApplication, level: number) => {
  await app.evaluate(({ BrowserWindow }, l) => BrowserWindow.getAllWindows()[0].webContents.setZoomLevel(l), level);
  await new Promise((r) => setTimeout(r, 500));
};

/** Sizes in CSS px of what the toolbar must keep intact (only the visible exercise counts). */
const measure = (page: Page) =>
  page.evaluate(() => {
    const visible = (sel: string) => [...document.querySelectorAll(sel)].filter((t) => (t as HTMLElement).offsetParent);
    const box = (el: Element) => el.getBoundingClientRect();
    const buttons = visible('[data-testid="run"], [data-testid="stop"], [data-testid="test"], [data-testid="hand-in"]');
    const hand = box(visible('[data-testid="hand-in"]')[0]!);
    return {
      viewport: innerWidth,
      handIn: { left: hand.left, right: hand.right },
      buttonsInside: buttons.every((b) => box(b).right <= innerWidth && box(b).left >= 0),
      buttonHeights: buttons.map((b) => Math.round(box(b).height)),
      tabHeights: visible('[data-testid="exam-tab"]').map((t) => Math.round(box(t).height))
    };
  });

for (const count of [4, 8]) {
  for (const level of [0, 1]) {
    test(`exam toolbar with ${count} tabs at zoom level ${level} (1024x700): Abgeben fully visible, one-line labels`, async () => {
      const { app, page } = await startExam(count);
      await zoom(app, level);
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: join(SHOTS, `t36-toolbar-exam-${count}-tabs-${level ? 120 : 100}.png`) });
      }
      const m = await measure(page);
      expect(m.buttonsInside).toBe(true);
      expect(m.handIn.right).toBeLessThanOrEqual(m.viewport);
      expect(new Set(m.buttonHeights).size).toBe(1); // no label wrapped
      expect(new Set(m.tabHeights).size).toBe(1);
      expect(m.tabHeights[0]).toBeLessThanOrEqual(36);
    });
  }
}

test("with 8 tabs at 120 % the tab row scrolls and the active tab is brought into view", async () => {
  const { app, page } = await startExam(8);
  await zoom(app, 1);
  const tabs = page.locator('[data-testid="exam-tabs"]:visible');
  expect(await tabs.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.locator('[data-testid="exam-tab"]:visible').last().click();
  await expect(page.locator('[data-testid="exam-tab"][aria-pressed="true"]:visible')).toHaveText("Aufgabe 8");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const row = [...document.querySelectorAll('[data-testid="exam-tabs"]')].find((e) => (e as HTMLElement).offsetParent)!;
        const tab = row.querySelector('[aria-pressed="true"]')!.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        return tab.left >= r.left - 1 && tab.right <= r.right + 1;
      })
    )
    .toBe(true);
  const m = await measure(page);
  expect(m.handIn.right).toBeLessThanOrEqual(m.viewport);
});

test("normal workspace: a long exercise title is cut off with an ellipsis, the buttons stay whole (120 %)", async () => {
  const root = mkdtempSync(join(tmpdir(), "jide-toolbar-"));
  dirs.push(root);
  copies(root, 1, () => "Eine sehr lange Aufgabenbezeichnung, die in der Kopfzeile unmöglich Platz findet und gekürzt werden muss");
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: root });
  await page.setViewportSize({ width: 1024, height: 700 });
  await openExercise(page, "Eine sehr lange");
  await zoom(app, 1);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, "t36-toolbar-workspace-long-title-120.png") });
  }
  const r = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const title = document.querySelector(".topbar .title") as HTMLElement;
    return {
      viewport: innerWidth,
      runRight: box('[data-testid="run"]').right,
      runHeight: box('[data-testid="run"]').height,
      stopHeight: box('[data-testid="stop"]').height,
      titleCut: title.scrollWidth > title.clientWidth,
      titleHeight: title.getBoundingClientRect().height
    };
  });
  expect(r.runRight).toBeLessThanOrEqual(r.viewport);
  expect(r.runHeight).toBe(r.stopHeight);
  expect(r.titleCut).toBe(true);
  expect(r.titleHeight).toBeLessThan(30); // one line
});
