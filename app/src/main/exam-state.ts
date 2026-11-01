import { tmpdir } from "node:os";
import { app, ipcMain } from "electron";
import type { ExamSession, ExamStartResult } from "../shared-types/api";
import { lookupJdkForReal, searchedLines } from "./jdk";
import { cleanExamName, detectExamMode, examPaths, type ExamMode } from "./exam-mode";
import { autosaveInterval } from "./exam-store";

let detected: { value: ExamMode | undefined } | undefined;

/** Exam mode of this process (decided once). */
export function examMode(): ExamMode | undefined {
  detected ??= {
    value: detectExamMode({
      isPackaged: app.isPackaged,
      execPath: process.execPath,
      examDirOverride: process.env["JIDE_EXAM_DIR"]
    })
  };
  return detected.value;
}

/**
 * Must run before app ready: redirects every writable Electron/Chromium path away from the exe
 * folder (a read-only share) to %TEMP%\JDE-exam.
 */
export function redirectPathsForExamMode(): void {
  if (!examMode()) return;
  const p = examPaths(tmpdir(), process.env["JIDE_USER_DATA_DIR"]);
  app.setPath("userData", p.userData);
  app.setPath("sessionData", p.sessionData);
  app.setPath("logs", p.logs);
  app.setPath("crashDumps", p.crashDumps);
  app.setPath("temp", p.temp);
  // Chromium caches (GPU, shader, HTTP) would otherwise default below userData/sessionData; be explicit.
  app.commandLine.appendSwitch("disk-cache-dir", `${p.sessionData}/Cache`);
}

let session: ExamSession | undefined;
let javaPath: string | undefined;

/**
 * Exam mode start-up, once, before the helper starts: checks exam.json (already parsed by detection)
 * and looks for a JDK 25+ (jdkPath -> JAVA_HOME -> PATH). A broken exam.json skips the lookup:
 * the app then only shows the error screen.
 */
export async function initExam(): Promise<void> {
  const exam = examMode();
  if (!exam) return;
  if (!exam.config) {
    session = { status: "config-error", message: exam.configError ?? "exam.json konnte nicht gelesen werden.", programDir: exam.dir };
    return;
  }
  const { title, handInPath, jdkPath, allowTests } = exam.config;
  const found = await lookupJdkForReal(jdkPath);
  javaPath = found.java;
  session = found.java
    ? { status: "ok", title, handInPath, allowTests, autosaveMs: autosaveInterval(process.env["JIDE_AUTOSAVE_MS"], app.isPackaged) }
    : { status: "no-jdk", title, handInPath, searched: searchedLines(found) };
}

/** What the exam screens show; undefined in online mode. Only valid after `initExam()`. */
export function examSession(): ExamSession | undefined {
  return session;
}

/** The java executable chosen by `initExam()`. */
export function examJavaPath(): string | undefined {
  return javaPath;
}

let studentName: string | null = null;

/** The name typed on the start screen (asked at every start, never persisted); null before. */
export function examStudentName(): string | null {
  return studentName;
}

/** False only in exam mode with `allowTests: false`. */
export function testsAllowed(): boolean {
  const exam = examMode();
  return !exam || exam.config?.allowTests !== false;
}

export const TESTS_NOT_ALLOWED_MESSAGE = "Testen ist in dieser Prüfung nicht erlaubt.";

export function registerExamIpc(): void {
  ipcMain.handle("jide:exam-start", (_e, name: unknown): ExamStartResult => {
    if (session?.status !== "ok") return { ok: false, message: "Die Prüfung kann nicht gestartet werden." };
    const clean = cleanExamName(name);
    if (!clean) return { ok: false, message: "Bitte gib deinen Namen ein." };
    studentName = clean;
    return { ok: true, name: clean };
  });
  ipcMain.handle("jide:exam-name", (): string | null => studentName);
}
