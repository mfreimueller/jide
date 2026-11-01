import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** What T22 knows about exam mode. exam.json is only read, not validated (T23). */
export interface ExamMode {
  /** Folder that contains exam.json and exercises/ (the folder of the exe when packaged). */
  dir: string;
  exercisesDir: string;
  /** `title` from exam.json, if it is a string. */
  title?: string;
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
 * `JIDE_EXAM_DIR`, if it contains exam.json. An unreadable or broken exam.json still means exam
 * mode in the packaged app (the folder was put there on purpose); T23 shows an error screen.
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
  let title: string | undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && typeof (parsed as { title?: unknown }).title === "string") {
      title = (parsed as { title: string }).title;
    }
  } catch {
    // broken JSON: validated in T23
  }
  return { dir, exercisesDir: join(dir, "exercises"), ...(title === undefined ? {} : { title }) };
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
