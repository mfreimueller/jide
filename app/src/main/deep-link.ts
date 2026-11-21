/**
 * `jide://` deep links, pure parsing and checks (no electron import, unit-tested).
 * Format: `jide://practice?src=<https URL of a practice zip>`.
 */

/** The only place practice zips may be downloaded from: origin + path prefix (change here only). */
export const PRACTICE_ORIGIN = "https://sj2627-pos-lernwerkstatt.github.io/";

/**
 * The allowed origin. Tests (and only tests: the user data folder override is set) may point it to a local
 * HTTP fixture server with `JIDE_TEST_PRACTICE_ORIGIN`, e.g. `http://127.0.0.1:5000/`.
 */
export function practiceOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const test = env["JIDE_TEST_PRACTICE_ORIGIN"];
  return env["JIDE_USER_DATA_DIR"] && test ? test : PRACTICE_ORIGIN;
}

export const MSG_UNKNOWN_LINK = "Unbekannter J;DE-Link.";
export const MSG_NO_SRC = "Der Link enthält keine Übungsadresse.";
export const MSG_BAD_ORIGIN = "Übungen können nur von der Kursseite geladen werden.";
export const MSG_EXAM_MODE = "Im Prüfungsmodus können keine Übungen geöffnet werden.";

export type DeepLink = { kind: "practice"; src: string } | { kind: "error"; message: string };

/** The first `jide://` argument (case-insensitive scheme), e.g. from `process.argv` or a second instance. */
export function findDeepLinkInArgv(argv: readonly string[]): string | undefined {
  return argv.find((a) => typeof a === "string" && a.toLowerCase().startsWith("jide://"));
}

/** Strict parse: only `jide://practice?src=<non-empty>`; anything else is an error with a German message. */
export function parseDeepLink(raw: string): DeepLink {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { kind: "error", message: MSG_UNKNOWN_LINK };
  }
  // "jide://practice?x" -> host "practice"; the path may be empty or "/".
  if (url.protocol !== "jide:" || url.host.toLowerCase() !== "practice" || (url.pathname !== "" && url.pathname !== "/")) {
    return { kind: "error", message: MSG_UNKNOWN_LINK };
  }
  if (url.username || url.password || url.port) return { kind: "error", message: MSG_UNKNOWN_LINK };
  const srcs = url.searchParams.getAll("src");
  if (srcs.length !== 1 || srcs[0].trim() === "") return { kind: "error", message: MSG_NO_SRC };
  return { kind: "practice", src: srcs[0].trim() };
}

/**
 * https (scheme, host, port equal to the origin), no credentials, and a path of exactly
 * `<origin path>practice/<file>.zip` or `<origin path><repo>/practice/<file>.zip`: any course site of the org,
 * `<repo>` and `<file>` single non-empty segments. `.zip` is matched case-insensitively. The URL parser has
 * already resolved `..` / `%2e%2e`, so the checked path is the one that is requested.
 */
export function isAllowedPracticeSrc(src: string, origin: string = practiceOrigin()): boolean {
  let url: URL;
  let allowed: URL;
  try {
    url = new URL(src);
    allowed = new URL(origin);
  } catch {
    return false;
  }
  const prefix = allowed.pathname.endsWith("/") ? allowed.pathname : `${allowed.pathname}/`;
  if (!url.pathname.startsWith(prefix) || /%2f|%5c|\\/i.test(url.pathname)) return false; // no encoded separators
  const seg = url.pathname.slice(prefix.length).split("/");
  const file = seg[seg.length - 1];
  const shapeOk =
    (seg.length === 2 && seg[0] === "practice") || (seg.length === 3 && seg[0] !== "" && seg[1] === "practice");
  return (
    shapeOk &&
    file.length > 4 &&
    url.protocol === allowed.protocol &&
    url.hostname === allowed.hostname &&
    url.port === allowed.port &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.toLowerCase().endsWith(".zip")
  );
}
