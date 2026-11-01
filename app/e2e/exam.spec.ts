import { expect, test } from "@playwright/test";
import { chmodSync, cpSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { examplesDir, launch, openExercise, useTempApp } from "./helpers";

useTempApp();

let examDir: string;

function snapshot(dir: string): string[] {
  return readdirSync(dir, { recursive: true }).map((f) => `${f}:${statSync(join(dir, String(f))).size}`).sort();
}

test.beforeEach(() => {
  examDir = mkdtempSync(join(tmpdir(), "jide-exam-"));
  writeFileSync(join(examDir, "exam.json"), JSON.stringify({ mode: "exam", title: "Probe", handInPath: "P:\\", jdkPath: null, allowTests: true }));
  cpSync(join(examplesDir, "summe"), join(examDir, "exercises", "summe"), { recursive: true });
});
test.afterEach(() => {
  chmodSync(examDir, 0o755);
  for (const e of readdirSync(examDir, { recursive: true, withFileTypes: true })) {
    if (e.isDirectory()) chmodSync(join(e.parentPath, e.name), 0o755);
  }
  rmSync(examDir, { recursive: true, force: true });
});

test("exam mode from a read-only folder: lists and opens an exercise, writes nothing into the folder", async () => {
  // read-only: no write permission on any directory
  chmodSync(examDir, 0o555);
  for (const e of readdirSync(examDir, { recursive: true, withFileTypes: true })) {
    if (e.isDirectory()) chmodSync(join(e.parentPath, e.name), 0o555);
  }
  const before = snapshot(examDir);

  // JIDE_EXERCISES_DIR is set by the helper; exam mode must win over it
  const { app, page } = await launch({ JIDE_EXAM_DIR: examDir });
  await expect(page.getByTestId("exercise")).toHaveCount(1); // only the exam folder, not JIDE_EXERCISES_DIR
  await openExercise(page, "Summe zweier Zahlen");
  await expect(page.getByRole("button", { name: "Abgeben" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ausführen" })).toBeVisible();

  // writable Electron paths are not inside the exam folder
  const paths = await app.evaluate(({ app: a }) => ({ userData: a.getPath("userData"), sessionData: a.getPath("sessionData"), logs: a.getPath("logs") }));
  for (const p of Object.values(paths)) expect(p.startsWith(examDir)).toBe(false);

  await app.close();
  expect(snapshot(examDir)).toEqual(before);
});
