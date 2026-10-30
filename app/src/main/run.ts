import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { app, ipcMain, type WebContents } from "electron";
import type { RunEndReason, RunEvent, RunStartResult } from "../shared-types/api";
import { buildRequest, helper, helperMessage } from "./compile";
import { findExercise } from "./exercises";
import { javaExecutable } from "./java";
import { OutputBatcher } from "./output";

const MAX_INPUT_CHARS = 64 * 1024;

interface ActiveRun {
  id: number;
  proc: ChildProcessWithoutNullStreams;
  runDir: string;
  stopRequested: boolean;
}

let starting = false;
let active: ActiveRun | undefined;
let runCounter = 0;

function removeDir(dir: string): Promise<void> {
  return rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
}

/** Kills a running program (leaving the exercise, closing the app). */
export function killRun(): void {
  if (!active) return;
  active.stopRequested = true;
  active.proc.kill();
}

function startProcess(sender: WebContents, runDir: string, mainClass: string): void {
  const id = ++runCounter;
  const send = (e: RunEvent): void => {
    if (!sender.isDestroyed()) sender.send("jide:run-event", e);
  };
  const proc = spawn(
    javaExecutable(),
    [
      "-Dstdout.encoding=UTF-8",
      "-Dstderr.encoding=UTF-8",
      "-Dstdin.encoding=UTF-8",
      "-cp",
      runDir,
      mainClass
    ],
    { cwd: runDir, stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
  );
  const run: ActiveRun = { id, proc, runDir, stopRequested: false };
  active = run;
  let limitHit = false;
  let ended = false;

  const batcher = new OutputBatcher(
    (chunks) => send({ runId: id, kind: "output", chunks }),
    () => {
      limitHit = true;
      proc.kill();
    }
  );
  const onDestroyed = (): void => killRun();
  sender.once("destroyed", onDestroyed);

  const end = (reason: RunEndReason, code: number | null, message?: string): void => {
    if (ended) return;
    ended = true;
    sender.removeListener("destroyed", onDestroyed);
    batcher.finish();
    if (active === run) active = undefined;
    send({ runId: id, kind: "ended", reason, code, ...(message ? { message } : {}) });
    void removeDir(runDir);
  };

  proc.on("spawn", () => send({ runId: id, kind: "started" }));
  proc.on("error", (e: NodeJS.ErrnoException) => {
    end("failed", null, e.code === "ENOENT" ? "Java wurde nicht gefunden." : "Das Programm konnte nicht gestartet werden.");
  });
  proc.stdout.on("data", (d: Buffer) => batcher.push("stdout", d));
  proc.stderr.on("data", (d: Buffer) => batcher.push("stderr", d));
  proc.stdin.on("error", () => undefined); // program already ended (EPIPE)
  proc.on("close", (code) => {
    const reason: RunEndReason = limitHit ? "output-limit" : run.stopRequested ? "stopped" : "exited";
    end(reason, code);
  });
}

export function registerRunIpc(): void {
  app.on("before-quit", killRun);
  app.on("will-quit", () => {
    if (active) rmSync(active.runDir, { recursive: true, force: true, maxRetries: 3 });
  });

  ipcMain.handle("jide:run", async (e, id: unknown, files: unknown): Promise<RunStartResult> => {
    if (starting || active) return { ok: false, message: "Es läuft bereits ein Programm." };
    starting = true;
    let runDir: string | undefined;
    try {
      const ex = await findExercise(id);
      if (!ex) return { ok: false, message: "Diese Aufgabe gibt es nicht." };
      // A fresh directory per run, so nothing of an earlier run is ever on the class path.
      runDir = await mkdtemp(join(tmpdir(), "jide-run-"));
      const req = buildRequest(ex, files, runDir);
      if (!req) return { ok: false, message: "Ungültige Anfrage." };
      let result;
      try {
        result = await helper.compile(req);
      } catch (err) {
        return { ok: false, message: helperMessage(err) };
      }
      if (!result.success) {
        return { ok: true, started: false, diagnostics: result.diagnostics };
      }
      const resources = join(ex.dir, "resources");
      if (existsSync(resources)) await cp(resources, runDir, { recursive: true });
      const mainClass = basename(ex.mainFile).replace(/\.java$/, "");
      startProcess(e.sender, runDir, mainClass);
      runDir = undefined; // now owned by the running program, which removes it when it ends
      return { ok: true, started: true, runId: runCounter, diagnostics: result.diagnostics };
    } finally {
      starting = false;
      if (runDir) void removeDir(runDir);
    }
  });

  ipcMain.on("jide:run-stop", () => killRun());

  ipcMain.on("jide:run-input", (_e, text: unknown) => {
    if (typeof text !== "string" || text.length > MAX_INPUT_CHARS || !active) return;
    active.proc.stdin.write(text);
  });
}
