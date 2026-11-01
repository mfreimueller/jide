import { tmpdir } from "node:os";
import { app } from "electron";
import { detectExamMode, examPaths, type ExamMode } from "./exam-mode";

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
