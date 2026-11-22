// Pure helpers for the jide:// desktop entry of an AppImage on Linux (M13 T65). No Electron, no file access.

export const DESKTOP_FILE_NAME = "jde-jide.desktop";
export const ICON_FILE_NAME = "jde.png";
export const ICON_SIZE_DIR = "512x512";

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Exec argument per the Desktop Entry spec: always double-quoted; inside the quotes `"`, backtick, `$` and
 * `\` get a backslash, then the string-value rule doubles every backslash again (so a literal backslash is
 * four in the file); `%` is written `%%` so it is not read as a field code. Returns null for a path that
 * cannot be written safely (empty, or control characters such as a newline).
 */
export function quoteExecArg(path: string): string | null {
  if (path === "" || CONTROL_CHARS.test(path)) return null;
  const quoted = path.replace(/["`$\\]/g, "\\$&");
  return `"${quoted.replace(/\\/g, "\\\\").replace(/%/g, "%%")}"`;
}

/** Content of `jde-jide.desktop`; null if the AppImage or icon path cannot be written safely. */
export function desktopEntryText(appImagePath: string, iconPath: string): string | null {
  const arg = quoteExecArg(appImagePath);
  // Icon is an absolute path (no quoting rules for it); a line break there would break the file.
  if (arg === null || CONTROL_CHARS.test(iconPath)) return null;
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=J;DE",
    `Exec=${arg} %u`,
    `Icon=${iconPath}`,
    "Terminal=false",
    "Categories=Education;Development;",
    "MimeType=x-scheme-handler/jide;",
    ""
  ].join("\n");
}

/** The entry is (re)written when it is missing or differs from what the current AppImage needs. */
export function needsRewrite(existing: string | null, desired: string): boolean {
  return existing !== desired;
}
