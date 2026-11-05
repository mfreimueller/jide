import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The colour scheme choice of Ansicht > Darstellung; "system" follows the OS. */
export type ThemeChoice = "system" | "light" | "dark";

export const DEFAULT_THEME: ThemeChoice = "system";

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "system" || v === "light" || v === "dark";
}

function readObject(file: string): Record<string, unknown> {
  try {
    const d: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof d === "object" && d !== null && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** userData/settings.json -> theme. A missing, unreadable or invalid file means "system". */
export function readTheme(file: string): ThemeChoice {
  const theme = readObject(file)["theme"];
  return isThemeChoice(theme) ? theme : DEFAULT_THEME;
}

/** Remembers the choice (other keys of the file stay). Never throws: a failed write only means the choice is not remembered. */
export function writeTheme(file: string, theme: ThemeChoice): void {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ ...readObject(file), theme }), "utf8");
    renameSync(tmp, file);
  } catch {
    // not remembered; the running app keeps the choice
  }
}
