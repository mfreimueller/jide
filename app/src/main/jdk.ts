import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const MIN_JAVA_MAJOR = 25;
export const JAVA_PROBE_TIMEOUT_MS = 10_000;

/** Result of running `java -XshowSettings:properties -version`. */
export type ProbeResult =
  | { kind: "output"; text: string } // stdout + stderr, whatever the exit code
  | { kind: "not-found" }
  | { kind: "timeout" }
  | { kind: "error" };

/** Injectable process runner (real one: `runJavaProbe`). */
export type ProbeRunner = (exe: string, args: string[]) => Promise<ProbeResult>;

export interface JdkEnv {
  jdkPath: string | null;
  javaHome: string | undefined;
  run: ProbeRunner;
  exists: (path: string) => boolean;
  platform: NodeJS.Platform;
}

export interface CandidateReport {
  /** JAVA_HOME / jdkPath value, if set. */
  value?: string;
  /** German, for the error screen. */
  outcome: string;
}

export interface JdkLookup {
  /** The java executable to use; undefined if no candidate qualifies. */
  java?: string;
  jdkPath: CandidateReport;
  javaHome: CandidateReport;
  path: CandidateReport;
}

export const JAVA_ARGS = ["-XshowSettings:properties", "-version"];

/** Real runner: one `java` start with a timeout and no console window. */
export const runJavaProbe: ProbeRunner = (exe, args) =>
  new Promise((resolve) => {
    execFile(exe, args, { timeout: JAVA_PROBE_TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (!err) return resolve({ kind: "output", text: `${stdout}\n${stderr}` });
      const e = err as NodeJS.ErrnoException & { killed?: boolean };
      if (e.code === "ENOENT") return resolve({ kind: "not-found" });
      if (e.killed) return resolve({ kind: "timeout" });
      if (typeof e.code === "number") return resolve({ kind: "output", text: `${stdout}\n${stderr}` }); // exit code != 0
      resolve({ kind: "error" });
    });
  });

/** `java.home` and the major version from the `-XshowSettings:properties` output. */
export function parseJavaProperties(text: string): { home?: string; major?: number } {
  const prop = (name: string): string | undefined => {
    const m = new RegExp(`^\\s*${name.replace(/\./g, "\\.")}\\s*=\\s*(.+?)\\s*$`, "m").exec(text);
    return m?.[1];
  };
  const home = prop("java.home");
  const major = majorOf(prop("java.specification.version")) ?? majorOf(prop("java.version"));
  return { ...(home === undefined ? {} : { home }), ...(major === undefined ? {} : { major }) };
}

/** "25" -> 25, "25.0.1" -> 25, "27-ea" -> 27, "1.8" / "1.8.0_402" -> 8. */
export function majorOf(version: string | undefined): number | undefined {
  if (!version) return undefined;
  const m = /^(\d+)(?:\.(\d+))?/.exec(version.trim());
  if (!m) return undefined;
  const first = Number(m[1]);
  if (first === 1 && m[2] !== undefined) return Number(m[2]);
  return first;
}

type Probe = { ok: true; java: string } | { ok: false; outcome: string };

async function probe(exe: string, env: JdkEnv): Promise<Probe> {
  const r = await env.run(exe, JAVA_ARGS);
  if (r.kind === "not-found") return { ok: false, outcome: "kein java gefunden" };
  if (r.kind !== "output") return { ok: false, outcome: "konnte nicht gestartet werden" };
  const { home, major } = parseJavaProperties(r.text);
  if (major === undefined || home === undefined) return { ok: false, outcome: "Java-Version nicht erkennbar" };
  if (major < MIN_JAVA_MAJOR) return { ok: false, outcome: `Java ${major}, zu alt` };
  const javac = join(home, "bin", env.platform === "win32" ? "javac.exe" : "javac");
  if (!env.exists(javac)) return { ok: false, outcome: "nur Java-Laufzeit (JRE), kein JDK" };
  return { ok: true, java: exe };
}

/** A JDK root folder given by exam.json or JAVA_HOME. */
async function probeRoot(root: string | null | undefined, env: JdkEnv): Promise<{ report: CandidateReport; java?: string }> {
  if (!root) return { report: { outcome: "nicht gesetzt" } };
  if (!env.exists(root)) return { report: { value: root, outcome: "Ordner nicht gefunden" } };
  const exe = join(root, "bin", env.platform === "win32" ? "java.exe" : "java");
  if (!env.exists(exe)) return { report: { value: root, outcome: "kein java gefunden" } };
  const p = await probe(exe, env);
  return p.ok ? { report: { value: root, outcome: "gefunden" }, java: p.java } : { report: { value: root, outcome: p.outcome } };
}

/**
 * Exam mode: jdkPath (exam.json) -> JAVA_HOME -> `java` on the PATH. The first candidate with
 * Java >= 25 and a javac wins; later candidates are not tried ("nicht geprüft").
 */
export async function lookupJdk(env: JdkEnv): Promise<JdkLookup> {
  const skipped: CandidateReport = { outcome: "nicht geprüft" };
  const a = await probeRoot(env.jdkPath, env);
  if (a.java) return { java: a.java, jdkPath: a.report, javaHome: skipped, path: skipped };
  const b = await probeRoot(env.javaHome, env);
  if (b.java) return { java: b.java, jdkPath: a.report, javaHome: b.report, path: skipped };
  const c = await probe("java", env);
  const path: CandidateReport = c.ok ? { outcome: "gefunden" } : { outcome: c.outcome };
  return { ...(c.ok ? { java: c.java } : {}), jdkPath: a.report, javaHome: b.report, path };
}

/** The lines of the "Gesucht in dieser Reihenfolge" box (Figma 10). */
export function searchedLines(r: JdkLookup): string[] {
  const lines: string[] = [];
  if (r.jdkPath.value === undefined) lines.push(`jdkPath (exam.json): ${r.jdkPath.outcome}`);
  else lines.push(`jdkPath (exam.json): ${r.jdkPath.value}`, `  → ${r.jdkPath.outcome}`);
  if (r.javaHome.value === undefined) lines.push(`JAVA_HOME: ${r.javaHome.outcome}`);
  else lines.push(`JAVA_HOME: ${r.javaHome.value}`, `  → ${r.javaHome.outcome}`);
  lines.push(`PATH: ${r.path.outcome}`);
  return lines;
}

export function lookupJdkForReal(jdkPath: string | null): Promise<JdkLookup> {
  return lookupJdk({
    jdkPath,
    javaHome: process.env["JAVA_HOME"],
    run: runJavaProbe,
    exists: existsSync,
    platform: process.platform
  });
}
