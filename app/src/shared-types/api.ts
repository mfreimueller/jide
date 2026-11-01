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
}

export interface ExerciseList {
  exercises: ExerciseSummary[];
  /** Loading errors, German messages. */
  errors: string[];
  /** Online mode only: the server could not be reached, the list comes from the cache. */
  offline: boolean;
}

/** Who is using the app. `student: null` = online mode without a (valid) stored code: show the login. */
export type AppSession =
  | { mode: "local" }
  | { mode: "online"; student: StudentInfo | null };

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

export interface OpenedExercise {
  id: string;
  title: string;
  /** Raw Markdown of aufgabe.md. */
  assignment: string;
  mainFile: string;
  files: OpenedFile[];
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
  /** Online mode: checks the code (case-insensitive) with the server and stores it. */
  login: (code: string) => Promise<LoginResult>;
  /** Called when the server no longer accepts the stored code (it has been deleted by then). */
  onSessionExpired: (handler: (message: string) => void) => () => void;
  /** Uploads the saved editable files. The caller flushes pending edits first. */
  handIn: (id: string) => Promise<HandInResult>;
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
