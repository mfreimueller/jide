export type ExerciseStatus = "neu" | "in-arbeit";

export interface ExerciseSummary {
  id: string;
  title: string;
  status: ExerciseStatus;
}

export interface ExerciseList {
  exercises: ExerciseSummary[];
  /** Loading errors, German messages. */
  errors: string[];
}

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

export interface JideApi {
  versions: { electron: string; chrome: string; node: string };
  /** Tells the main process that the start screen has rendered (used by the smoke test). */
  notifyEditorReady: () => void;
  listExercises: () => Promise<ExerciseList>;
  openExercise: (id: string) => Promise<OpenResult>;
  saveFile: (id: string, path: string, content: string) => Promise<SaveResult>;
  resetFile: (id: string, path: string) => Promise<SaveResult>;
  /** Compiles all files (current editor contents) without running. */
  compile: (id: string, files: SourceFileInput[]) => Promise<CompileResult>;
  /** Compiles into a fresh run directory and, if there are no errors, starts the program. */
  run: (id: string, files: SourceFileInput[]) => Promise<RunStartResult>;
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
