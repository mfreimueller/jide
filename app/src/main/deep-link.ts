/**
 * `jide://` deep links, pure parsing and checks (no electron import, unit-tested).
 * Format: `jide://practice?src=<https URL of a practice zip>`.
 */

/**
 * Test-only relaxation: `JIDE_TEST_PRACTICE_INSECURE=1` allows `http:` and an explicit port (the e2e fixture
 * server), and only while the user data folder override is set. The host must still be in the course list.
 */
export function practiceInsecure(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env["JIDE_USER_DATA_DIR"]) && env["JIDE_TEST_PRACTICE_INSECURE"] === "1";
}

export const MSG_UNKNOWN_LINK = "Unbekannter J;DE-Link.";
export const MSG_NO_SRC = "Der Link enthält keine Übungsadresse.";
export const MSG_BAD_ORIGIN =
  "Übungen können nur von Seiten geladen werden, die deine Lehrkraft für deinen Kurs freigegeben hat.";
export const MSG_LOGIN_REQUIRED =
  "Melde dich zuerst mit deinem persönlichen Code an und klick dann den Link noch einmal.";
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
 * `https`, host (lower-cased) exactly one of `hosts` (no subdomain matching), default port only, no credentials,
 * a path ending in `.zip` (case-insensitive) with a non-empty file name, no encoded separators. The URL parser
 * has already resolved `..` / `%2e%2e`, so the checked path is the one that is requested. `insecure` (tests
 * only, see `practiceInsecure`) also allows `http:` and an explicit port.
 */
export function isAllowedPracticeSrc(src: string, hosts: readonly string[], insecure: boolean = practiceInsecure()): boolean {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  const schemeOk = url.protocol === "https:" || (insecure && url.protocol === "http:");
  const file = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  return (
    schemeOk &&
    hosts.some((h) => h.toLowerCase() === url.hostname) &&
    (insecure || url.port === "") &&
    url.username === "" &&
    url.password === "" &&
    !/%2f|%5c|\\/i.test(url.pathname) &&
    file.length > 4 &&
    file.toLowerCase().endsWith(".zip")
  );
}
