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

export interface JideApi {
  versions: { electron: string; chrome: string; node: string };
  /** Tells the main process that the start screen has rendered (used by the smoke test). */
  notifyEditorReady: () => void;
  listExercises: () => Promise<ExerciseList>;
  openExercise: (id: string) => Promise<OpenResult>;
  saveFile: (id: string, path: string, content: string) => Promise<SaveResult>;
  resetFile: (id: string, path: string) => Promise<SaveResult>;
  /**
   * Registers the handler that main calls before the window closes.
   * The window stays open until the returned promise has settled.
   */
  onFlushRequest: (handler: () => Promise<void>) => void;
}
