import { createServer, type Server } from "node:http";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { zipSync, type Zippable } from "fflate";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { examplesDir, launch, openExercise, setEditorText, useTempApp } from "./helpers";

useTempApp();

const TITLE = "Summe zweier Zahlen";

function readDir(dir: string, base = dir, out: Zippable = {}): Zippable {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) readDir(p, base, out);
    else out[relative(base, p).split(sep).join("/")] = readFileSync(p);
  }
  return out;
}

/** A local stand-in for the course page: serves the "summe" fixture as a zip; counts requests per path. */
async function fixtureServer(): Promise<{ server: Server; origin: string; hits: string[] }> {
  const zip = Buffer.from(zipSync(readDir(join(examplesDir, "summe"))));
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? "");
    if (req.url === "/p/summe.zip") {
      res.writeHead(200, { "content-type": "application/zip", "content-length": zip.length });
      res.end(zip);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}/p/`, hits };
}

const link = (src: string): string => `jide://practice?src=${encodeURIComponent(src)}`;

/** What `second-instance` does with the argv of a second start. */
async function sendLink(app: ElectronApplication, src: string): Promise<void> {
  await app.evaluate(({ app: a }, l) => a.emit("second-instance", {}, ["x", l], process.cwd(), {}), link(src));
}

async function expectOpenedCopy(page: Page): Promise<void> {
  await expect(page.getByTestId("scratch-chip")).toBeVisible();
  await expect(page.locator(".monaco-editor .view-lines").first()).toBeVisible();
  await expect(page.getByText(TITLE).first()).toBeVisible();
}

let fixture: Awaited<ReturnType<typeof fixtureServer>>;
test.beforeEach(async () => {
  fixture = await fixtureServer();
});
test.afterEach(() => new Promise<void>((r) => fixture.server.close(() => r())));

const env = (): Record<string, string> => ({ JIDE_TEST_PRACTICE_ORIGIN: fixture.origin });

test("a link imports the exercise into Scratch and opens it; the same link again opens the same copy", async () => {
  const { app, page } = await launch(env());
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  await sendLink(app, `${fixture.origin}summe.zip`);
  await expectOpenedCopy(page);
  await expect(page.getByTestId("app-notice")).toHaveCount(0);
  expect(fixture.hits).toEqual(["/p/summe.zip"]);

  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE })).toHaveCount(1);

  await sendLink(app, `${fixture.origin}summe.zip`);
  await expectOpenedCopy(page);
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE })).toHaveCount(1);
  expect(fixture.hits).toHaveLength(1); // no second download
});

test("a link from another origin is refused and nothing is imported", async () => {
  const { app, page } = await launch(env());
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  await sendLink(app, "https://example.com/p/summe.zip");
  await expect(page.getByTestId("app-notice")).toHaveText("Übungen können nur von der Kursseite geladen werden.");
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);
  expect(fixture.hits).toHaveLength(0);
});

test("an unreachable server shows the offline error", async () => {
  const dead = await fixtureServer();
  await new Promise<void>((r) => dead.server.close(() => r()));
  const { app, page } = await launch({ JIDE_TEST_PRACTICE_ORIGIN: dead.origin });
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  await sendLink(app, `${dead.origin}summe.zip`);
  await expect(page.getByTestId("app-notice")).toHaveText("Die Übung konnte nicht geladen werden. Bist du mit dem Internet verbunden?");
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);
});

test("a missing zip shows the 404 error", async () => {
  const { app, page } = await launch(env());
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  await sendLink(app, `${fixture.origin}gibt-es-nicht.zip`);
  await expect(page.getByTestId("app-notice")).toHaveText("Diese Übung gibt es auf der Kursseite nicht (mehr).");
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);
});

test("exam mode ignores the link: notice, no download, nothing imported", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  try {
    writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
    cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
    const { page } = await launch({ ...env(), JIDE_EXAM_DIR: examDir }, undefined, [link(`${fixture.origin}summe.zip`)]);
    await expect(page.getByTestId("app-notice")).toHaveText("Im Prüfungsmodus können keine Übungen geöffnet werden.");
    await expect(page.getByTestId("exam-start")).toBeVisible();
    expect(fixture.hits).toHaveLength(0);
  } finally {
    rmSync(examDir, { recursive: true, force: true });
  }
});

test("a link while an exercise with unsaved edits is open saves the edits, then opens the practice exercise", async () => {
  const { app, page } = await launch(env());
  await openExercise(page, "Größere Zahl");
  const MARK = "// unsaved-before-link";
  await setEditorText(app, page, `${MARK}\nvoid main() {}\n`);
  await sendLink(app, `${fixture.origin}summe.zip`);
  await expectOpenedCopy(page);

  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await openExercise(page, "Größere Zahl");
  await expect(page.locator(".monaco-editor .view-lines").first()).toContainText(MARK);
});

test("a link on the online login screen switches to Scratch and opens the exercise", async () => {
  const { app, page } = await launch({ ...env(), JIDE_EXERCISES_DIR: "", JIDE_API_URL: "http://127.0.0.1:9" });
  await expect(page.getByTestId("open-scratch")).toBeVisible();
  await sendLink(app, `${fixture.origin}summe.zip`);
  await expectOpenedCopy(page);
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE })).toHaveCount(1);
});
