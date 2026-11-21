import { expect, test } from "@playwright/test";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, useTempApp } from "./helpers";

useTempApp();

const ZIP = "https://sj2627-pos-lernwerkstatt.github.io/practice/schleifen.zip";
const link = (src: string): string => `jide://practice?src=${encodeURIComponent(src)}`;

test("an unknown jide:// link shows the German error", async () => {
  const { page } = await launch({}, undefined, ["jide://foo"]);
  await expect(page.getByTestId("app-notice")).toHaveText("Unbekannter J;DE-Link.");
});

test("a practice link without src shows the German error", async () => {
  const { page } = await launch({}, undefined, ["jide://practice"]);
  await expect(page.getByTestId("app-notice")).toHaveText("Der Link enthält keine Übungsadresse.");
});

test("a practice link from another origin is refused", async () => {
  const { page } = await launch({}, undefined, [link("https://example.com/x.zip")]);
  await expect(page.getByTestId("app-notice")).toHaveText("Übungen können nur von der Kursseite geladen werden.");
});

test("a second start forwards its link to the running instance", async () => {
  const { app, page } = await launch();
  await expect(page.getByTestId("exercise").first()).toBeVisible();
  // what `second-instance` does with the argv of the second start
  await app.evaluate(({ app: a }) => a.emit("second-instance", {}, ["x", "jide://foo"], process.cwd(), {}));
  await expect(page.getByTestId("app-notice")).toHaveText("Unbekannter J;DE-Link.");
});

test("exam mode ignores practice links and says so", async () => {
  const examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  try {
    writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
    cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
    const { page } = await launch({ JIDE_EXAM_DIR: examDir }, undefined, [link(ZIP)]);
    await expect(page.getByTestId("app-notice")).toHaveText("Im Prüfungsmodus können keine Übungen geöffnet werden.");
    await expect(page.getByTestId("exam-start")).toBeVisible();
  } finally {
    rmSync(examDir, { recursive: true, force: true });
  }
});
