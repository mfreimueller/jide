import type { Diagnostic, OpenedFile, OpenedImage, TestResult } from "./api";

/**
 * Messages between the main window (the owner of all exercise state) and the windows of detached
 * panels (M10). Main only relays them; it never looks into them.
 */

/** One change of the console; the owner records them so a new Konsole window can replay the history. */
export type ConsoleOp =
  | { op: "system"; text: string }
  | { op: "error"; text: string }
  | { op: "output"; stream: "stdout" | "stderr"; text: string }
  | { op: "echo"; text: string }
  | { op: "clear" }
  | { op: "running"; running: boolean };

export type RunStateName = "idle" | "starting" | "running";

export interface PanelFileInfo {
  path: string;
  editable: boolean;
  /** Lines of the student's code (the console only links stack frames that exist). */
  lineCount: number;
}

export interface PanelTestsState {
  state: "idle" | "running";
  last?: { results: TestResult[]; summary: { passed: number; total: number }; at: string };
  /** The code changed since the last run. */
  stale: boolean;
  mainFile: string;
}

/** Everything the detached panels show except the editor text; sent again after every change. */
export interface PanelState {
  saveState: "saved" | "saving" | "error";
  saveError: string;
  runState: RunStateName;
  files: PanelFileInfo[];
  openTabs: string[];
  active: string;
  diagnostics: Diagnostic[];
  systemError: string;
  /** Absent: this exercise has no tests. */
  tests?: PanelTestsState;
  assignment: {
    markdown: string;
    deadline: string | null;
    submittedAt: string | null;
    late: boolean;
    /** Scratch: "Angabe wählen …" / "Ändern …". */
    canPick: boolean;
  };
}

export interface PanelInit {
  exercise: {
    id: string;
    title: string;
    mainFile: string;
    /** The live editor contents, not the saved ones. */
    files: OpenedFile[];
    images: OpenedImage[];
  };
  state: PanelState;
  consoleLog: ConsoleOp[];
}

/** Owner -> detached windows. */
export type OwnerMessage =
  | { kind: "init"; panel: string; init: PanelInit }
  | { kind: "state"; state: PanelState }
  | { kind: "console-op"; op: ConsoleOp }
  /** The Code window shows the position (Probleme, stack frames, test rows). */
  | { kind: "reveal"; path: string; line: number; column: number };

/** Detached window -> owner. */
export type WindowMessage =
  | { kind: "hello"; panel: string }
  | { kind: "edit"; path: string; content: string }
  | { kind: "open-file"; path: string }
  | { kind: "open-at"; path: string; line: number; column?: number }
  | { kind: "run" }
  | { kind: "stop" }
  | { kind: "test" }
  | { kind: "clear-console" }
  /** Local echo of what was typed into a detached Konsole, so the owner's console has it too. */
  | { kind: "console-op"; op: ConsoleOp }
  | { kind: "pick-assignment" }
  /** Alt+1/2/3 typed in a detached window toggles the panel in the main window. */
  | { kind: "toggle-panel"; panel: "files" | "assign" | "bottom" };
