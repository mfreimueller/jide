import { app, ipcMain } from "electron";
import type { Exercise } from "@jide/shared";
import type { CompileResult } from "../shared-types/api";
import { examSession } from "./exam-state";
import { findExercise } from "./exercises";
import { HelperClient, HelperError, type HelperCompileRequest } from "./helper";
import { helperJarPath, javaExecutable } from "./java";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

export const helper = new HelperClient(javaExecutable, helperJarPath());

/**
 * Builds the helper request from what the renderer sent: only files of the exercise are used
 * (missing ones fall back to the original), the hidden harness comes from the exercise itself.
 */
export function buildRequest(ex: Exercise, files: unknown, outDir?: string): HelperCompileRequest | undefined {
  if (!Array.isArray(files)) return undefined;
  const given = new Map<string, string>();
  for (const f of files as unknown[]) {
    const o = f as { path?: unknown; content?: unknown } | null;
    if (!o || typeof o.path !== "string" || typeof o.content !== "string") return undefined;
    if (Buffer.byteLength(o.content, "utf8") > MAX_CONTENT_BYTES) return undefined;
    given.set(o.path, o.content);
  }
  const req: HelperCompileRequest = {
    files: ex.files.map((f) => ({ path: f.path, content: given.get(f.path) ?? ex.originals[f.path] ?? "" }))
  };
  if (ex.harness && ex.harnessContent !== undefined) {
    req.harness = { appendTo: ex.harness.appendTo, content: ex.harnessContent };
  }
  if (outDir) req.outDir = outDir;
  return req;
}

export function helperMessage(e: unknown): string {
  return e instanceof HelperError ? e.message : "Der Java-Helfer hat nicht geantwortet.";
}

export function registerCompileIpc(): void {
  // Starts the helper early (and finds out about a missing Java) so the first compile is fast.
  // (Not in exam mode with a broken exam.json or without a JDK: only the error screen is shown.)
  const exam = examSession();
  if (!exam || exam.status === "ok") void helper.ping().catch(() => undefined);
  app.on("will-quit", () => helper.shutdown());

  ipcMain.handle("jide:compile", async (_e, id: unknown, files: unknown): Promise<CompileResult> => {
    const ex = await findExercise(id);
    if (!ex) return { ok: false, message: "Diese Aufgabe gibt es nicht." };
    const req = buildRequest(ex, files);
    if (!req) return { ok: false, message: "Ungültige Anfrage." };
    try {
      const r = await helper.compile(req);
      return { ok: true, success: r.success, diagnostics: r.diagnostics };
    } catch (e) {
      return { ok: false, message: helperMessage(e) };
    }
  });
}
