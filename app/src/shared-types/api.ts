export type ExerciseStatus = "neu" | "in-arbeit" | "abgegeben";

export interface ExerciseSummary {
  id: string;
  title: string;
  status: ExerciseStatus;
  /** Soft deadline, ISO 8601 UTC; null in local mode or without deadline. */
  deadline: string | null;
  /** Last hand-in made on this laptop or restored from the server (ISO 8601 UTC). */
  submittedAt: string | null;
  /** The last hand-in came after the deadline. */
  late: boolean;
  /** Exercise group of the course (see ExerciseList.groups); null = ungrouped, always null in local and exam mode. */
  groupId: number | null;
}

export interface ExerciseGroup {
  id: number;
  name: string;
}

export interface ExerciseList {
  exercises: ExerciseSummary[];
  /** Groups in the teacher's order (online mode; empty otherwise). */
  groups: ExerciseGroup[];
  /** Loading errors, German messages. */
  errors: string[];
  /** Online mode only: the server could not be reached, the list comes from the cache. */
  offline: boolean;
}

/** Who is using the app. `student: null` = online mode without a (valid) stored code: show the login. */
export type AppSession =
  | { mode: "local" }
  | { mode: "online"; student: StudentInfo | null }
  | { mode: "exam"; exam: ExamSession };

/** Exam mode start-up result (T23): what the exam screens show. */
export type ExamSession =
  | { status: "ok"; title: string; handInPath: string; allowTests: boolean; autosaveMs: number }
  /** exam.json is broken (screen 09). `programDir` = folder of the exe. */
  | { status: "config-error"; message: string; programDir: string }
  /** No JDK 25 found (screen 10). `searched` = the lines of the "Gesucht in dieser Reihenfolge" box. */
  | { status: "no-jdk"; title: string; handInPath: string; searched: string[] };

/** Last write to the hand-in drive that was tried (autosave or hand-in); `at` is ISO 8601 UTC. */
export interface SaveStatus {
  ok: boolean;
  at: string;
}

/** Result of entering the name on the exam start screen (T24). */
export type ExamStartResult = { ok: true; name: string } | { ok: false; message: string };

export interface StudentInfo {
  name: string;
  course: { subject: string; className: string };
}

export type LoginResult = { ok: true; student: StudentInfo } | { ok: false; message: string };

export type HandInResult =
  | { ok: true; submittedAt: string; late: boolean }
  | { ok: false; message: string };

export interface OpenedFile {
  path: string;
  content: string;
  editable: boolean;
}

/** Read-only SVG diagram of an exercise (not a Java file, never handed in). */
export interface OpenedImage {
  path: string;
  title?: string;
  /** SVG text; the renderer shows it as an <img> data URL only. */
  svg: string;
}

export interface OpenedExercise {
  id: string;
  title: string;
  /** Raw Markdown of aufgabe.md. */
  assignment: string;
  mainFile: string;
  files: OpenedFile[];
  /** Read-only SVG diagrams, shown below the Java files. */
  images: OpenedImage[];
  deadline: string | null;
  submittedAt: string | null;
  late: boolean;
  /** The exercise has tests (tests.yaml): show "Testen". */
  hasTests: boolean;
}

export type OpenResult = { ok: true; exercise: OpenedExercise } | { ok: false; message: string };
export type SaveResult = { ok: true } | { ok: false; message: string };

export interface SourceFileInput {
  path: string;
  content: string;
}

/** One javac diagnostic. Line/column are 1-based UTF-16 positions (same as Monaco). */
export interface Diagnostic {
  /** Null for general errors without a source file. */
  file: string | null;
  line: number | null;
  column: number | null;
  endLine: number | null;
  endColumn: number | null;
  severity: "error" | "warning";
  /** German message from javac. */
  message: string;
  /** "harness": the error is in the code appended by the exercise, not in the student's code. */
  origin: "student" | "harness";
}

export type CompileResult =
  | { ok: true; success: boolean; diagnostics: Diagnostic[] }
  /** The helper or Java is not available. German message. */
  | { ok: false; message: string };

/**
 * started=false: compile errors, nothing was started.
 * started=true: the program runs; its events follow on the run-event channel (starting with "started").
 */
export type RunStartResult =
  | { ok: true; started: false; diagnostics: Diagnostic[] }
  | { ok: true; started: true; runId: number; diagnostics: Diagnostic[] }
  | { ok: false; message: string };

export type RunEndReason = "exited" | "stopped" | "output-limit" | "failed";

/** Events of the one running program, in order. Output is batched (~16 ms) by the main process. */
export type RunEvent =
  | { runId: number; kind: "started" }
  | { runId: number; kind: "output"; chunks: { stream: "stdout" | "stderr"; text: string }[] }
  | { runId: number; kind: "ended"; reason: RunEndReason; code: number | null; message?: string };

export interface TestResult {
  name: string;
  status: "passed" | "failed" | "error";
  /** Failed tests: what the test expected and what the program produced. */
  expected?: string;
  actual?: string;
  /** Failed io tests: how the output was compared and what was typed in (the Tests panel draws a line diff from these). */
  match?: "exact" | "contains" | "trimmed" | "lines";
  input?: string;
  /** Errors (and failed `code` tests): German explanation, e.g. exception with line number. */
  message?: string;
  /** Line in the student's main file where an exception was thrown, if known. */
  line?: number;
}

/**
 * started=false: compile errors in the student's code, no test ran.
 * started=true: all tests ran; results are in the order of tests.yaml. `summary` fits TestSummary of the hand-in.
 */
export type TestRunResult =
  | { ok: true; started: false; diagnostics: Diagnostic[] }
  | { ok: true; started: true; results: TestResult[]; summary: { passed: number; total: number } }
  | { ok: false; message: string };

export interface JideApi {
  versions: { electron: string; chrome: string; node: string };
  /** Tells the main process that the start screen has rendered (used by the smoke test). */
  notifyEditorReady: () => void;
  listExercises: () => Promise<ExerciseList>;
  openExercise: (id: string) => Promise<OpenResult>;
  saveFile: (id: string, path: string, content: string) => Promise<SaveResult>;
  resetFile: (id: string, path: string) => Promise<SaveResult>;
  /** Local mode or online mode (with or without a stored code). */
  getSession: () => Promise<AppSession>;
  /** Exam mode: stores the student's name in main (trimmed; it goes into abgabe.json in T25). */
  startExam: (name: string) => Promise<ExamStartResult>;
  /** Exam mode: the name given at this start, or null before "Prüfung starten". */
  getExamName: () => Promise<string | null>;
  /**
   * Exam mode: copies the saved files of the given exercises (default: all opened ones) to the
   * hand-in drive. The caller flushes the editors first.
   */
  examAutosave: (ids?: string[]) => Promise<void>;
  /** Exam mode: result of every autosave / hand-in that was tried. Returns the unsubscribe function. */
  onSaveStatus: (handler: (s: SaveStatus) => void) => () => void;
  /** Exam mode: main asks whether to close although the last changes were not handed in. */
  onCloseConfirm: (handler: () => void) => () => void;
  /** Answer to `onCloseConfirm`: true = close anyway. */
  answerClose: (leave: boolean) => void;
  /** Quits the app (exam error screens). */
  quit: () => void;
  /** Online mode: checks the code (case-insensitive) with the server and stores it. */
  login: (code: string) => Promise<LoginResult>;
  /** Called when the server no longer accepts the stored code (it has been deleted by then). */
  onSessionExpired: (handler: (message: string) => void) => () => void;
  /** Called after the student chose "Abmelden" in the menu (main has deleted the code). */
  onLoggedOut: (handler: () => void) => () => void;
  /**
   * Uploads the saved editable files. The caller flushes pending edits first.
   * `testSummary`: result of the last test run if it is still current, otherwise null.
   */
  handIn: (id: string, testSummary: { passed: number; total: number } | null) => Promise<HandInResult>;
  /** Compiles all files (current editor contents) without running. */
  compile: (id: string, files: SourceFileInput[]) => Promise<CompileResult>;
  /** Compiles into a fresh run directory and, if there are no errors, starts the program. */
  run: (id: string, files: SourceFileInput[]) => Promise<RunStartResult>;
  /** Runs all tests of the exercise (tests.yaml) against the given file contents. */
  test: (id: string, files: SourceFileInput[]) => Promise<TestRunResult>;
  /** Kills the running program (no-op if none). */
  stopRun: () => void;
  /** Sends text (a line including its newline) to the stdin of the running program. */
  sendInput: (text: string) => void;
  /** Subscribes to run events; returns the unsubscribe function. */
  onRunEvent: (handler: (e: RunEvent) => void) => () => void;
  /**
   * Registers the handler that main calls before the window closes.
   * The window stays open until the returned promise has settled.
   */
  onFlushRequest: (handler: () => Promise<void>) => void;
}
