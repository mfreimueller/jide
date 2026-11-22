import { createServer, type Server } from "node:http";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { zipSync, type Zippable } from "fflate";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { card, examplesDir, launch, openExercise, setEditorText, useTempApp } from "./helpers";
import { dbReachable, login, startBackend, stopAllBackends } from "./online-helpers";

useTempApp();

test.beforeAll(async () => {
  test.skip(!(await dbReachable()), "MariaDB (docker compose up -d) is not running");
});
test.afterEach(stopAllBackends);

const TITLE = "Summe zweier Zahlen";
const MSG_BAD_HOST = "Übungen können nur von Seiten geladen werden, die deine Lehrkraft für deinen Kurs freigegeben hat.";
const MSG_LOGIN = "Melde dich zuerst mit deinem persönlichen Code an und klick dann den Link noch einmal.";
const MSG_OFFLINE = "Die Übung konnte nicht geladen werden. Bist du mit dem Internet verbunden?";

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
  // like the live course zips: still carries the retired difficulty key (practice links read leniently)
  const old = readDir(join(examplesDir, "summe"));
  old["exercise.yaml"] = Buffer.from(Buffer.from(old["exercise.yaml"] as Uint8Array).toString("utf8").replace("kind: pflicht", "difficulty: newbie"));
  const oldZip = Buffer.from(zipSync(old));
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? "");
    if (req.url === "/kurs/practice/summe.zip" || req.url === "/kurs/practice/alt.zip") {
      const body = req.url.endsWith("alt.zip") ? oldZip : zip;
      res.writeHead(200, { "content-type": "application/zip", "content-length": body.length });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, hits };
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

const zipUrl = (name = "summe.zip"): string => `${fixture.origin}kurs/practice/${name}`;

/**
 * Online mode against the fixture backend, signed in. The course's practice hosts are inserted directly (the
 * backend refuses IP literals): the local zip server is `127.0.0.1`. JIDE_TEST_PRACTICE_INSECURE allows its
 * http + port, nothing else.
 */
async function signedIn(hosts: string[] = ["127.0.0.1"], insecure = "1") {
  const backend = await startBackend();
  await backend.setPracticeHosts(hosts);
  const l = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url, JIDE_TEST_PRACTICE_INSECURE: insecure });
  await login(l.page, backend.code);
  await expect(card(l.page, "Summe zweier Zahlen")).toBeVisible();
  return { ...l, backend };
}

test("signed in, allowed host: a link imports the exercise into Scratch and opens it; the same link again opens the same copy", async () => {
  const { app, page, backend } = await signedIn();
  await sendLink(app, zipUrl());
  await expectOpenedCopy(page);
  await expect(page.getByTestId("app-notice")).toHaveCount(0);
  expect(fixture.hits).toEqual(["/kurs/practice/summe.zip"]);

  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE })).toHaveCount(1);
  // practice links are always an Übung, although the yaml says kind: pflicht
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE }).getByTestId("kind")).toHaveAttribute("data-kind", "uebung");
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE }).getByTestId("kind")).toHaveText("Übung");

  // an existing copy opens without any host check or network: also with an empty host list
  await backend.setPracticeHosts([]);
  await sendLink(app, zipUrl());
  await expectOpenedCopy(page);
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE })).toHaveCount(1);
  expect(fixture.hits).toHaveLength(1); // no second download
});

test("a practice zip that still carries difficulty imports (lenient) and shows Übung", async () => {
  const { app, page } = await signedIn();
  await sendLink(app, zipUrl("alt.zip"));
  await expectOpenedCopy(page);
  await expect(page.getByTestId("app-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await expect(page.getByTestId("scratch-item").filter({ hasText: TITLE }).getByTestId("kind")).toHaveAttribute("data-kind", "uebung");
});

test("a host that is not in the course list is refused and nothing is imported", async () => {
  const { app, page } = await signedIn();
  await sendLink(app, "https://example.com/kurs/practice/summe.zip");
  await expect(page.getByTestId("app-notice")).toHaveText(MSG_BAD_HOST);
  await sendLink(app, zipUrl().replace("127.0.0.1", "localhost"));
  await expect(page.getByTestId("app-notice")).toHaveText(MSG_BAD_HOST);
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);
  expect(fixture.hits).toHaveLength(0);
});

test("without the test override a plain http link with a port is refused even for a listed host", async () => {
  const { app, page } = await signedIn(["127.0.0.1"], "");
  await sendLink(app, zipUrl());
  await expect(page.getByTestId("app-notice")).toHaveText(MSG_BAD_HOST);
  expect(fixture.hits).toHaveLength(0);
});

test("not signed in (login screen): the login notice, nothing downloaded, no switch to Scratch", async () => {
  const backend = await startBackend();
  await backend.setPracticeHosts(["127.0.0.1"]);
  const { app, page } = await launch({ JIDE_EXERCISES_DIR: "", JIDE_API_URL: backend.url, JIDE_TEST_PRACTICE_INSECURE: "1" });
  await expect(page.getByTestId("open-scratch")).toBeVisible();
  await sendLink(app, zipUrl());
  await expect(page.getByTestId("app-notice")).toHaveText(MSG_LOGIN);
  await expect(page.getByTestId("open-scratch")).toBeVisible();
  expect(fixture.hits).toHaveLength(0);
});

test("an unreachable zip server shows the offline error", async () => {
  const dead = await fixtureServer();
  await new Promise<void>((r) => dead.server.close(() => r()));
  const { app, page } = await signedIn();
  await sendLink(app, `${dead.origin}kurs/practice/summe.zip`);
  await expect(page.getByTestId("app-notice")).toHaveText(MSG_OFFLINE);
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);
});

test("a stopped backend (hosts cannot be fetched) shows the offline error, nothing downloaded", async () => {
  const { app, page, backend } = await signedIn();
  await backend.stop();
  await sendLink(app, zipUrl());
  await expect(page.getByTestId("app-notice")).toHaveText(MSG_OFFLINE);
  expect(fixture.hits).toHaveLength(0);
});

test("a missing zip shows the 404 error", async () => {
  const { app, page } = await signedIn();
  await sendLink(app, zipUrl("gibt-es-nicht.zip"));
  await expect(page.getByTestId("app-notice")).toHaveText("Diese Übung gibt es auf der Kursseite nicht (mehr).");
  await expect(page.getByTestId("scratch-item")).toHaveCount(0);
});

test("exam mode ignores the link: notice, no download, nothing imported", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  try {
    writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
    cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
    const { page } = await launch({ JIDE_TEST_PRACTICE_INSECURE: "1", JIDE_EXAM_DIR: examDir }, undefined, [link(zipUrl())]);
    await expect(page.getByTestId("app-notice")).toHaveText("Im Prüfungsmodus können keine Übungen geöffnet werden.");
    await expect(page.getByTestId("exam-start")).toBeVisible();
    expect(fixture.hits).toHaveLength(0);
  } finally {
    rmSync(examDir, { recursive: true, force: true });
  }
});

test("a link while an exercise with unsaved edits is open saves the edits, then opens the practice exercise", async () => {
  const { app, page } = await signedIn();
  await openExercise(page, "Größere Zahl");
  const MARK = "// unsaved-before-link";
  await setEditorText(app, page, `${MARK}\nvoid main() {}\n`);
  await sendLink(app, zipUrl());
  await expectOpenedCopy(page);

  await page.getByRole("button", { name: "← Aufgaben" }).click();
  await openExercise(page, "Größere Zahl");
  await expect(page.locator(".monaco-editor .view-lines").first()).toContainText(MARK);
});
