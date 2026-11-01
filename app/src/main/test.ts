import { app, ipcMain } from "electron";
import type { TestRunResult } from "../shared-types/api";
import { isTesting, setTesting } from "./busy";
import { testsAllowed, TESTS_NOT_ALLOWED_MESSAGE } from "./exam-state";
import { buildRequest, helper, helperMessage } from "./compile";
import { findExercise } from "./exercises";
import { javaExecutable } from "./java";
import { isProgramRunning } from "./run";
import { runTests } from "./test-runner";

let abort: AbortController | undefined;

/** Stops a running test run (leaving the exercise, closing the app). */
export function killTests(): void {
  abort?.abort();
}

export function registerTestIpc(): void {
  app.on("before-quit", killTests);

  ipcMain.handle("jide:test", async (e, id: unknown, files: unknown): Promise<TestRunResult> => {
    if (!testsAllowed()) return { ok: false, message: TESTS_NOT_ALLOWED_MESSAGE };
    if (isTesting() || isProgramRunning()) return { ok: false, message: "Es läuft bereits ein Programm." };
    setTesting(true);
    const controller = new AbortController();
    abort = controller;
    const onDestroyed = (): void => controller.abort();
    e.sender.once("destroyed", onDestroyed);
    try {
      const ex = await findExercise(id);
      if (!ex) return { ok: false, message: "Diese Aufgabe gibt es nicht." };
      if (!ex.tests || ex.tests.length === 0) return { ok: false, message: "Zu dieser Aufgabe gibt es keine Tests." };
      const req = buildRequest(ex, files);
      if (!req) return { ok: false, message: "Ungültige Anfrage." };
      try {
        const outcome = await runTests(ex, req.files, {
          compile: (r) => helper.compile(r),
          javaPath: javaExecutable(),
          signal: controller.signal
        });
        return { ok: true, ...outcome };
      } catch (err) {
        return { ok: false, message: helperMessage(err) };
      }
    } finally {
      e.sender.removeListener("destroyed", onDestroyed);
      if (abort === controller) abort = undefined;
      setTesting(false);
    }
  });
}
