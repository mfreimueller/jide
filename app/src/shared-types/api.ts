import type { GradeLineComment, GradeSymbol } from "./grade";
import type { OwnerMessage, WindowMessage } from "./panel-messages";
import type { DetachablePanel } from "./panel-windows";

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
  /** A Scratch program (own work without a server): own section, no hand-in. Absent = false. */
  scratch?: boolean;
  /** Scratch items: number of .java files ("Eigenes Programm · 2 Klassen"). */
  classCount?: number;
  /** A Scratch item made by "Aufgabe importieren" ("Importiert · N Tests"). Absent = false. */
  imported?: boolean;
  /** Imported items: number of tests. */
  testCount?: number;
  /** Imported items made by "In Scratch kopieren" ("Kopie · N Tests"). Absent = false. */
  copied?: boolean;
  /** Category pill on the card (never in exam mode); null = none (own Scratch programs). */
  kind: "pflicht" | "uebung" | "bonus" | null;
  /** Online mode: set once the exercise is graded (then it opens read-only). Absent = not graded. */
  grade?: { symbol: GradeSymbol; gradedAt: string };
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
/** A short German message from main for the page (error or plain information). */
export interface AppNotice {
  kind: "error" | "info";
  text: string;
}

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
  /** `graded`: the exercise was graded in the meantime (server answer GRADED); the list has been refreshed. */
  | { ok: false; message: string; graded?: boolean };

/** The graded hand-in of an exercise (online mode); the opened files are the graded ones, read-only. */
export interface GradedView {
  symbol: GradeSymbol;
  /** Overall comment; may be empty. */
  comment: string;
  gradedAt: string;
  submittedAt: string;
  lineComments: GradeLineComment[];
}

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
  /** A Scratch program: no "Abgeben", classes can be added, the Angabe can be picked. Absent = false. */
  scratch?: boolean;
  /** Imported Scratch items: the classes that came with the exercise; they cannot be deleted. */
  importedFiles?: string[];
  /** Graded exercise: the files are the graded hand-in; the editor is read-only and nothing can be run or handed in. */
  graded?: GradedView;
}

/** A hand-in from another device that is newer than this laptop's code, which has unsubmitted changes: the student decides. */
export interface NewerHandIn {
  submittedAt: string;
  late: boolean;
}

/** `newerHandIn` set: `exercise` holds the local files; answer with resolveNewerHandIn before showing them. */
export type OpenResult = { ok: true; exercise: OpenedExercise; newerHandIn?: NewerHandIn } | { ok: false; message: string };
export type SaveResult = { ok: true } | { ok: false; message: string };

/** Result of "Speichern unter …"; `canceled`: the student closed the save dialog. */
export type ProjectSaveResult = { ok: true; canceled?: boolean } | { ok: false; message: string };

/** Result of a Scratch operation; German message on failure. */
export type ScratchResult<T = unknown> = ({ ok: true } & T) | { ok: false; message: string };

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
  /** Errors: an additional German hint for the student, shown below the message as a secondary note. */
  hint?: string;
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

/** What the bug report (T44) needs from the main process. Never contains the code or other secrets. */
export interface ReportEnv {
  appVersion: string;
  /** "Windows 11 (10.0.22631)" */
  os: string;
  mode: "local" | "online" | "exam";
  /** First 8 hex digits of the downloaded package's version (online mode); null if unknown. */
  packageVersion: string | null;
}

export type ReportSaveResult = { ok: true } | { ok: false; canceled: boolean };

/** Panels in their own windows (M10). */
export interface PanelsApi {
  /** Which panel this window shows; undefined = the main window. */
  window: DetachablePanel | undefined;
  /** The workspace of an exercise is shown (not in exam mode): main may open panel windows for it. */
  enter: (title: string, id: number) => void;
  /** The exercise is left: main closes all its panel windows. */
  leave: (id: number) => void;
  /** Opens the window of a panel; false if it is not possible (exam mode, no exercise). */
  detach: (panel: DetachablePanel) => Promise<boolean>;
  /** Docks the panel back: closes its window. */
  dock: (panel: DetachablePanel) => void;
  /** Brings the window of a detached panel to the front. */
  focus: (panel: DetachablePanel) => void;
  /** From a panel window: brings the main window to the front. */
  focusMain: () => void;
  getDetached: () => Promise<DetachablePanel[]>;
  /** The set of detached panels changed (also by closing a window). */
  onChange: (handler: (detached: DetachablePanel[]) => void) => () => void;
  /** Panel window -> main window. */
  toOwner: (msg: WindowMessage) => void;
  onFromWindow: (handler: (msg: WindowMessage) => void) => () => void;
  /** Main window -> all panel windows. */
  toWindows: (msg: OwnerMessage) => void;
  onFromOwner: (handler: (msg: OwnerMessage) => void) => () => void;
}

export interface JideApi {
  panels: PanelsApi;
  versions: { electron: string; chrome: string; node: string };
  /** Tells the main process that the start screen has rendered (used by the smoke test). */
  notifyEditorReady: () => void;
  listExercises: () => Promise<ExerciseList>;
  /** Only the Scratch programs (no backend call; works before login and in local mode, empty in exam mode). */
  listScratch: () => Promise<ExerciseList>;
  openExercise: (id: string) => Promise<OpenResult>;
  /** Answer to the "newer hand-in" question of openExercise: "load" replaces the local code, "keep" keeps it. Returns the exercise to show. */
  resolveNewerHandIn: (id: string, choice: "load" | "keep") => Promise<OpenResult>;
  saveFile: (id: string, path: string, content: string) => Promise<SaveResult>;
  resetFile: (id: string, path: string) => Promise<SaveResult>;
  /** Scratch (local and online mode, also before login; refused in exam mode): new program, `id` is the new item. */
  scratchCreate: (title: string) => Promise<ScratchResult<{ id: string }>>;
  scratchRename: (id: string, title: string) => Promise<ScratchResult>;
  /** Removes the item and its workspace. */
  scratchDelete: (id: string) => Promise<ScratchResult>;
  /** Adds `<name>.java` with an empty class; `path` is the new file. */
  scratchAddClass: (id: string, name: string) => Promise<ScratchResult<{ path: string }>>;
  /** Deletes an added class; Main.java is refused. */
  scratchDeleteClass: (id: string, path: string) => Promise<ScratchResult>;
  /** Copies the .md file at `path` into the item as aufgabe.md. */
  scratchPickAssignment: (id: string, path: string) => Promise<ScratchResult>;
  /** Opens the file dialog (.md) and copies the chosen file into the item; `canceled` = nothing chosen. */
  scratchChooseAssignment: (id: string) => Promise<ScratchResult<{ canceled?: boolean }>>;
  /**
   * "Speichern unter …": saves the open project (the saved files, so flush the editor first) as an exercise ZIP that
   * "Importieren" reads back; shows the save dialog. Refused in exam mode.
   */
  saveProjectAs: (id: string) => Promise<ProjectSaveResult>;
  /** The menu (Datei > Speichern unter …) asks the open workspace to save its project. */
  onSaveProjectRequest: (handler: () => void) => () => void;
  /** Imports a teacher-format exercise into Scratch: shows the dialog (a folder or a .zip). Refused in exam mode. */
  scratchImport: (kind: "folder" | "zip") => Promise<ScratchResult<{ id?: string; canceled?: boolean }>>;
  /**
   * "In Scratch kopieren": copies a server exercise (package + `mode` "fresh" = starter code, "mine" = the student's
   * current code) into a new Scratch item, like an import. `id` is the new item. Refused in exam mode.
   */
  scratchCopyExercise: (id: string, mode: "fresh" | "mine") => Promise<ScratchResult<{ id: string }>>;
  /** Same with a known path (tests). */
  scratchImportPath: (kind: "folder" | "zip", path: string) => Promise<ScratchResult<{ id: string }>>;
  /**
   * Exercises the student hid or showed by hand (only on this laptop, per account); empty in exam mode.
   * Everything else follows the automatic rule (see hiding.ts).
   */
  hiddenGet: () => Promise<Record<string, "hidden" | "shown">>;
  /** Sets the choice of one exercise (null = automatic again); returns all choices. */
  hiddenSet: (id: string, mode: "hidden" | "shown" | null) => Promise<Record<string, "hidden" | "shown">>;
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
  /** The code editor's font size in px (Ansicht > Editor-Schrift; the same in every window, not saved). */
  editorFontSize: () => Promise<number>;
  /** Called when the menu changed the editor font size. */
  onEditorFontSize: (handler: (size: number) => void) => () => void;
  /** Quits the app (exam error screens). */
  quit: () => void;
  /** Online mode: checks the code (case-insensitive) with the server and stores it. */
  login: (code: string) => Promise<LoginResult>;
  /** Called when the server no longer accepts the stored code (it has been deleted by then). */
  onSessionExpired: (handler: (message: string) => void) => () => void;
  /** Called after the student chose "Abmelden" in the menu (main has deleted the code). */
  onLoggedOut: (handler: () => void) => () => void;
  /** Short messages pushed by main (e.g. a bad `jide://` link); shown as a toast. */
  onNotice: (handler: (notice: AppNotice) => void) => () => void;
  /** The main window's App is mounted and subscribed to `onNotice`; main then sends queued messages. */
  notifyAppReady: () => void;
  /** A `jide://practice` link was imported (or its copy found): open this Scratch exercise. */
  onOpenExercise: (handler: (id: string) => void) => () => void;
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
  /** Bug report (T44): app version, OS, mode and package version of the exercise. */
  reportEnv: (exerciseId: string) => Promise<ReportEnv>;
  /** Bug report: asks where to save and writes the text as UTF-8. */
  reportSave: (defaultName: string, text: string) => Promise<ReportSaveResult>;
  /** Bug report: puts the text on the clipboard. */
  reportCopy: (text: string) => Promise<void>;
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
