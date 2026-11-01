import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ExamConfigError, parseExamConfig, type ExamConfig } from "@jide/shared";

/** What the app knows about exam mode: the parsed exam.json, or why it is broken. */
export interface ExamMode {
  /** Folder that contains exam.json and exercises/ (the folder of the exe when packaged). */
  dir: string;
  exercisesDir: string;
  /** The validated exam.json. Exactly one of `config` and `configError` is set. */
  config?: ExamConfig;
  /** German parser message; a broken exam.json is still exam mode (error screen only). */
  configError?: string;
}

export interface DetectInput {
  isPackaged: boolean;
  /** `process.execPath`. */
  execPath: string;
  /** `JIDE_EXAM_DIR`; only honoured when not packaged. */
  examDirOverride?: string;
  readText?: (path: string) => string;
}

/**
 * Packaged: exam mode if `exam.json` exists next to the exe. Unpackaged (dev, e2e): the folder in
 * `JIDE_EXAM_DIR`, if it contains exam.json. A broken exam.json still means exam
 * mode in the packaged app (the folder was put there on purpose); the app then shows an error screen.
 */
export function detectExamMode(input: DetectInput): ExamMode | undefined {
  const read = input.readText ?? ((p: string) => readFileSync(p, "utf8"));
  let dir: string;
  if (input.isPackaged) dir = dirname(input.execPath);
  else if (input.examDirOverride) dir = input.examDirOverride;
  else return undefined;

  let text: string;
  try {
    text = read(join(dir, "exam.json"));
  } catch {
    return undefined;
  }
  const base = { dir, exercisesDir: join(dir, "exercises") };
  try {
    return { ...base, config: parseExamConfig(text) };
  } catch (e) {
    const message = e instanceof ExamConfigError ? e.message : "exam.json konnte nicht gelesen werden.";
    return { ...base, configError: message };
  }
}

export interface ExamPaths {
  userData: string;
  sessionData: string;
  logs: string;
  crashDumps: string;
  temp: string;
}

/**
 * Every writable Electron path of the exam mode. `userDataOverride` is JIDE_USER_DATA_DIR (tests);
 * otherwise everything lives below `<tmp>/JDE-exam`.
 */
export function examPaths(tmpDir: string, userDataOverride?: string): ExamPaths {
  if (userDataOverride) {
    return {
      userData: userDataOverride,
      sessionData: join(userDataOverride, "electron", "session"),
      logs: join(userDataOverride, "electron", "logs"),
      crashDumps: join(userDataOverride, "electron", "crashDumps"),
      temp: join(userDataOverride, "electron", "temp")
    };
  }
  const root = join(tmpDir, "JDE-exam");
  return {
    userData: join(root, "userData"),
    sessionData: join(root, "session"),
    logs: join(root, "logs"),
    crashDumps: join(root, "crashDumps"),
    temp: join(root, "temp")
  };
}
