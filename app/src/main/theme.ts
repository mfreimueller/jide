import { join } from "node:path";
import { app, BrowserWindow, nativeTheme } from "electron";
import { readTheme, writeTheme, type ThemeChoice } from "./settings";

/** userData/settings.json; in exam mode userData is in %TEMP%, never next to the exe. */
function settingsFile(): string {
  return join(app.getPath("userData"), "settings.json");
}

/** The remembered choice (default "system"). */
export function storedTheme(): ThemeChoice {
  return readTheme(settingsFile());
}

/** Applies the choice to the app; the renderer follows through prefers-color-scheme. */
export function applyTheme(theme: ThemeChoice): void {
  nativeTheme.themeSource = theme;
}

/** Applies and remembers the choice (menu item). */
export function chooseTheme(theme: ThemeChoice): void {
  applyTheme(theme);
  writeTheme(settingsFile(), theme);
}

/** The app background (--bg-app) of the current scheme, so a new window does not flash white in dark. */
export function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? "#111113" : "#f8f9fa";
}

/** Keeps the background of open windows in step when the scheme changes. */
export function watchWindowBackground(): void {
  nativeTheme.on("updated", () => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.setBackgroundColor(windowBackground());
    }
  });
}
