/** F5 = Ausführen, Shift+F5 = Testen: what a key press does, with the same enabled state as the buttons. */

export interface RunShortcutState {
  /** False in the graded read-only view (no toolbar there). */
  runnable: boolean;
  runState: "idle" | "starting" | "running";
  /** Undefined: the exercise has no (allowed) tests, so there is no Testen button. */
  testsState: "idle" | "running" | undefined;
}

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** True for the keys this module handles (also when the action is disabled: the key is swallowed). */
export function isRunShortcutKey(e: KeyLike): boolean {
  return e.key === "F5" && !e.altKey && !e.ctrlKey && !e.metaKey;
}

/** The action of a key press; undefined when the matching button would be disabled or absent. */
export function runShortcut(e: KeyLike, s: RunShortcutState): "run" | "test" | undefined {
  if (!isRunShortcutKey(e)) return undefined;
  // the buttons: both are disabled while a program runs or the tests run
  if (!s.runnable || s.runState !== "idle" || s.testsState === "running") return undefined;
  if (e.shiftKey) return s.testsState === undefined ? undefined : "test";
  return "run";
}
