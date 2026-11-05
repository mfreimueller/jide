/**
 * The colour scheme the app is shown in. Main sets nativeTheme.themeSource (system / light / dark,
 * Ansicht > Darstellung); Chromium turns that into prefers-color-scheme. CSS reacts on its own, this
 * is for the parts that are drawn by JavaScript (Monaco, xterm).
 */
const QUERY = "(prefers-color-scheme: dark)";

export function isDarkScheme(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Calls `handler` whenever the scheme changes; returns the function that stops it. */
export function onColorSchemeChange(handler: (dark: boolean) => void): () => void {
  const query = window.matchMedia(QUERY);
  const listener = (e: MediaQueryListEvent): void => handler(e.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
