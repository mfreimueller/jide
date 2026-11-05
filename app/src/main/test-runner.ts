import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { matchOutput, type CheckTestCase, type Exercise, type IoTestCase } from "@jide/shared";
import type { Diagnostic, TestResult } from "../shared-types/api";
import type { HelperCompileRequest, HelperCompileResponse } from "./helper";

/** Same cap as "Ausführen" (SPEC 3.2). */
export const MAX_OUTPUT_BYTES = 1024 * 1024;
const CHECK_SLACK_MS = 5000;
/** io tests time the whole process, so JVM startup (slow on school laptops with antivirus) gets extra time. */
export const IO_STARTUP_ALLOWANCE_MS = 3000;
const RESULTS_FILE = "__jide_results.txt";

export const TIMEOUT_MESSAGE = "Dein Programm hat zu lange gebraucht (Endlosschleife?)";
export const OUTPUT_LIMIT_MESSAGE = "Dein Programm hat sehr viel ausgegeben und wurde gestoppt (Endlosschleife?).";
export const EARLY_EXIT_MESSAGE = "Das Programm wurde vorzeitig beendet.";
export const MAIN_CLASH_MESSAGE = "Für die Tests darf deine Datei keine Methode main(String[] args) haben.";
const HARNESS_PREFIX = "Fehler im vorgegebenen Code";

export interface TestRunDeps {
  compile: (req: HelperCompileRequest) => Promise<HelperCompileResponse>;
  javaPath: string;
  /** Kills all processes and stops the run (leaving the exercise, closing the app). */
  signal?: AbortSignal;
}

export type TestOutcome =
  | { started: false; diagnostics: Diagnostic[] }
  | { started: true; results: TestResult[]; summary: { passed: number; total: number } };

// ---- generated check code -------------------------------------------------------------------

/** Fixed part of the generated code; the per-test calls are added by generateCheckCode. */
const CHECK_RUNTIME = String.raw`
String __jideText(Object o) {
    if (o == null) return "null";
    if (o instanceof Object[] a) return java.util.Arrays.deepToString(a);
    if (o instanceof int[] a) return java.util.Arrays.toString(a);
    if (o instanceof long[] a) return java.util.Arrays.toString(a);
    if (o instanceof double[] a) return java.util.Arrays.toString(a);
    if (o instanceof float[] a) return java.util.Arrays.toString(a);
    if (o instanceof boolean[] a) return java.util.Arrays.toString(a);
    if (o instanceof char[] a) return java.util.Arrays.toString(a);
    if (o instanceof byte[] a) return java.util.Arrays.toString(a);
    if (o instanceof short[] a) return java.util.Arrays.toString(a);
    return String.valueOf(o);
}

String __jideEsc(String s) {
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r");
}

void __jideRun(java.io.Writer w, int idx, boolean isCode, long timeoutMs,
               java.util.concurrent.Callable<Object> c) throws Exception {
    Object[] box = new Object[2];
    Thread t = new Thread(() -> {
        try { box[0] = c.call(); } catch (Throwable e) { box[1] = e; }
    });
    t.setDaemon(true);
    t.start();
    t.join(timeoutMs);
    String kind;
    String payload = "";
    String line = "";
    if (t.isAlive()) {
        kind = "timeout";
    } else if (box[1] != null) {
        Throwable e = (Throwable) box[1];
        kind = "err";
        payload = e.toString();
        for (StackTraceElement f : e.getStackTrace()) {
            if (__jideFile.equals(f.getFileName()) && f.getLineNumber() > 0 && f.getLineNumber() <= __jideLines) {
                line = String.valueOf(f.getLineNumber());
                break;
            }
        }
    } else if (isCode) {
        kind = Boolean.TRUE.equals(box[0]) ? "ok" : "no";
    } else {
        kind = "val";
        payload = __jideText(box[0]);
    }
    w.write(idx + "\t" + kind + "\t" + __jideEsc(payload) + "\t" + line + "\n");
    w.flush();
}
`;

function lineCount(s: string): number {
  if (s === "") return 0;
  const parts = s.split(/\r\n|\r|\n/);
  return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length;
}

/**
 * Java code appended to the student's main file. It is an instance method `main(String[])`, which the
 * Java launcher prefers over a `void main()`. `tests` are the check tests, numbered by position.
 */
export function generateCheckCode(
  tests: { index: number; test: CheckTestCase }[],
  mainFileName: string,
  studentLines: number
): string {
  const calls = tests.map(({ index, test }) => {
    const isCode = "code" in test;
    const body = isCode ? `() -> {\n${test.code}\n}` : `() -> (Object) (\n${test.call}\n)`;
    return `    __jideRun(__jideW, ${index}, ${isCode}, ${test.timeoutMs}L, ${body});`;
  });
  return [
    `final String __jideFile = ${JSON.stringify(mainFileName)};`,
    `final int __jideLines = ${studentLines};`,
    CHECK_RUNTIME,
    "void main(String[] __jideArgs) throws Exception {",
    "    java.io.Writer __jideW = new java.io.OutputStreamWriter(",
    "        new java.io.FileOutputStream(__jideArgs[0]), java.nio.charset.StandardCharsets.UTF_8);",
    ...calls,
    "    __jideW.close();",
    "    System.exit(0);",
    "}",
    ""
  ].join("\n");
}

/** True if the (comment-stripped) source declares a `main` taking a String array. */
export function declaresMainWithArgs(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n\r]*/g, " ");
  return /\bvoid\s+main\s*\(\s*(?:final\s+)?String\s*(?:\[\s*\]\s*\w*|\.\.\.\s*\w*|\w+\s*\[\s*\])\s*\)/.test(code);
}

function unescapeField(s: string): string {
  return s.replace(/\\([\\tnr])/g, (_m, c: string) => (c === "t" ? "\t" : c === "n" ? "\n" : c === "r" ? "\r" : "\\"));
}

export interface CheckLine {
  index: number;
  kind: string;
  payload: string;
  line?: number;
}

export function parseCheckResults(text: string): Map<number, CheckLine> {
  const out = new Map<number, CheckLine>();
  for (const raw of text.split("\n")) {
    const f = raw.split("\t");
    if (f.length < 4) continue;
    const index = Number(f[0]);
    if (!Number.isInteger(index)) continue;
    const line = f[3] ? Number(f[3]) : undefined;
    out.set(index, { index, kind: f[1]!, payload: unescapeField(f[2]!), ...(line ? { line } : {}) });
  }
  return out;
}

// ---- processes ------------------------------------------------------------------------------

function javaArgs(dir: string, mainClass: string, extra: string[] = []): string[] {
  return [
    "-Dstdout.encoding=UTF-8",
    "-Dstderr.encoding=UTF-8",
    "-Dstdin.encoding=UTF-8",
    "-cp",
    dir,
    mainClass,
    ...extra
  ];
}

interface IoRun {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  limitHit: boolean;
  spawnError?: string;
}

function runIo(deps: TestRunDeps, dir: string, mainClass: string, test: IoTestCase): Promise<IoRun> {
  return new Promise((resolve) => {
    const proc = spawn(deps.javaPath, javaArgs(dir, mainClass), {
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let bytes = 0;
    let timedOut = false;
    let limitHit = false;
    let spawnError: string | undefined;
    const take = (list: Buffer[]) => (d: Buffer) => {
      if (limitHit) return;
      bytes += d.length;
      list.push(d);
      if (bytes > MAX_OUTPUT_BYTES) {
        limitHit = true;
        proc.kill();
      }
    };
    proc.stdout.on("data", take(out));
    proc.stderr.on("data", take(err));
    proc.stdin.on("error", () => undefined); // program ended without reading its input (EPIPE)
    proc.stdin.end(test.input);
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, test.timeoutMs + IO_STARTUP_ALLOWANCE_MS);
    const onAbort = (): void => void proc.kill();
    deps.signal?.addEventListener("abort", onAbort, { once: true });
    proc.on("error", (e: NodeJS.ErrnoException) => {
      spawnError = e.code === "ENOENT" ? "Java wurde nicht gefunden." : "Das Programm konnte nicht gestartet werden.";
    });
    proc.on("close", () => {
      clearTimeout(timer);
      deps.signal?.removeEventListener("abort", onAbort);
      resolve({
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        timedOut,
        limitHit,
        ...(spawnError ? { spawnError } : {})
      });
    });
  });
}

function runCheckProcess(deps: TestRunDeps, dir: string, mainClass: string, resultsPath: string, limitMs: number): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(deps.javaPath, javaArgs(dir, mainClass, [resultsPath]), {
      cwd: dir,
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true
    });
    proc.stdin.on("error", () => undefined);
    proc.stdin.end();
    const timer = setTimeout(() => proc.kill(), limitMs);
    const onAbort = (): void => void proc.kill();
    deps.signal?.addEventListener("abort", onAbort, { once: true });
    const done = (): void => {
      clearTimeout(timer);
      deps.signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    proc.on("error", done);
    proc.on("close", done);
  });
}

// ---- result mapping -------------------------------------------------------------------------

/** First stack frame of the student's main file in a Java stack trace (only lines up to maxLine). */
function studentLineFromTrace(stderr: string, fileName: string, maxLine: number): number | undefined {
  const re = new RegExp(`\\(${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)\\)`);
  for (const l of stderr.split(/\r?\n/)) {
    const m = re.exec(l);
    if (m && Number(m[1]) <= maxLine) return Number(m[1]);
  }
  return undefined;
}

function withLine(message: string, line: number | undefined): string {
  return line ? `${message} (Zeile ${line})` : message;
}

function ioResult(test: IoTestCase, run: IoRun, mainFileName: string, studentLines: number): TestResult {
  const name = test.name;
  if (run.spawnError) return { name, status: "error", message: run.spawnError };
  if (run.limitHit) return { name, status: "error", message: OUTPUT_LIMIT_MESSAGE };
  if (run.timedOut) return { name, status: "error", message: TIMEOUT_MESSAGE };
  const first = run.stderr.split(/\r?\n/).find((l) => l.startsWith("Exception in thread "));
  if (first !== undefined) {
    const line = studentLineFromTrace(run.stderr, mainFileName, studentLines);
    const message = first.replace(/^Exception in thread "[^"]*" /, "");
    return { name, status: "error", message: withLine(message, line), ...(line ? { line } : {}) };
  }
  if (matchOutput(run.stdout, test.expected, test.match)) return { name, status: "passed" };
  return { name, status: "failed", expected: test.expected, actual: run.stdout, match: test.match, input: test.input };
}

function checkResult(test: CheckTestCase, r: CheckLine | undefined): TestResult {
  const name = test.name;
  if (!r) return { name, status: "error", message: EARLY_EXIT_MESSAGE };
  switch (r.kind) {
    case "timeout":
      return { name, status: "error", message: TIMEOUT_MESSAGE };
    case "err":
      return { name, status: "error", message: withLine(r.payload, r.line), ...(r.line ? { line: r.line } : {}) };
    case "ok":
      return { name, status: "passed" };
    case "no":
      return { name, status: "failed", message: "Die Prüfung war nicht erfüllt." };
    case "val": {
      if ("call" in test && r.payload.trim() === test.expected.trim()) return { name, status: "passed" };
      return { name, status: "failed", expected: "call" in test ? test.expected : "", actual: r.payload };
    }
    default:
      return { name, status: "error", message: EARLY_EXIT_MESSAGE };
  }
}

// ---- orchestration --------------------------------------------------------------------------

type CompileOutcome =
  | { kind: "ok" }
  | { kind: "student"; diagnostics: Diagnostic[] }
  | { kind: "harness"; message: string };

async function compileInto(
  deps: TestRunDeps,
  files: { path: string; content: string }[],
  harness: { appendTo: string; content: string } | undefined,
  outDir: string
): Promise<CompileOutcome> {
  const r = await deps.compile({ files, ...(harness ? { harness } : {}), outDir });
  if (r.success) return { kind: "ok" };
  const errors = r.diagnostics.filter((d) => d.severity === "error");
  if (errors.some((d) => d.origin === "student")) return { kind: "student", diagnostics: r.diagnostics };
  const h = errors.find((d) => d.origin === "harness");
  if (h) {
    if (/main\(String\[\]\)/.test(h.message) && /bereits|already/.test(h.message)) {
      return { kind: "harness", message: MAIN_CLASH_MESSAGE };
    }
    return { kind: "harness", message: h.message.startsWith(HARNESS_PREFIX) ? h.message : `${HARNESS_PREFIX}: ${h.message}` };
  }
  return { kind: "student", diagnostics: r.diagnostics };
}

async function freshDir(ex: Exercise, tag: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `jide-${tag}-`));
  const resources = join(ex.dir, "resources");
  if (existsSync(resources)) await cp(resources, dir, { recursive: true });
  return dir;
}

function removeDir(dir: string): Promise<void> {
  return rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
}

/**
 * Runs all tests of the exercise against the student's files (already resolved to the full file list).
 * Helper failures (HelperError) propagate to the caller. Temp directories are always removed.
 */
export async function runTests(ex: Exercise, files: { path: string; content: string }[], deps: TestRunDeps): Promise<TestOutcome> {
  const tests = ex.tests ?? [];
  const mainContent = files.find((f) => f.path === ex.mainFile)?.content ?? "";
  const mainFileName = basename(ex.mainFile);
  const mainClass = mainFileName.replace(/\.java$/, "");
  const studentLines = lineCount(mainContent);

  const io = tests.flatMap((test, index) => (test.type === "io" ? [{ index, test }] : []));
  const checks = tests.flatMap((test, index) => (test.type === "check" ? [{ index, test }] : []));
  const results: (TestResult | undefined)[] = new Array<TestResult | undefined>(tests.length).fill(undefined);
  const dirs: string[] = [];
  const fail = (list: { index: number; test: { name: string } }[], message: string): void => {
    for (const { index, test } of list) results[index] = { name: test.name, status: "error", message };
  };

  try {
    // 1. io tests: compiled like "Ausführen", with the exercise's own harness.
    let ioDir: string | undefined;
    if (io.length > 0) {
      ioDir = await freshDir(ex, "test-io");
      dirs.push(ioDir);
      const harness =
        ex.harness && ex.harnessContent !== undefined ? { appendTo: ex.harness.appendTo, content: ex.harnessContent } : undefined;
      const c = await compileInto(deps, files, harness, ioDir);
      if (c.kind === "student") return { started: false, diagnostics: c.diagnostics };
      if (c.kind === "harness") {
        fail(io, c.message);
        ioDir = undefined;
      }
    }

    // 2. check tests: the generated code is appended instead of the harness.
    let checkDir: string | undefined;
    if (checks.length > 0) {
      if (declaresMainWithArgs(mainContent)) {
        fail(checks, MAIN_CLASH_MESSAGE);
      } else {
        checkDir = await freshDir(ex, "test-check");
        dirs.push(checkDir);
        const code = generateCheckCode(checks as { index: number; test: CheckTestCase }[], mainFileName, studentLines);
        const c = await compileInto(deps, files, { appendTo: ex.mainFile, content: code }, checkDir);
        if (c.kind === "student") return { started: false, diagnostics: c.diagnostics };
        if (c.kind === "harness") {
          fail(checks, c.message);
          checkDir = undefined;
        }
      }
    }

    if (ioDir) {
      for (const { index, test } of io) {
        if (deps.signal?.aborted) break;
        const run = await runIo(deps, ioDir, mainClass, test as IoTestCase);
        results[index] = ioResult(test as IoTestCase, run, mainFileName, studentLines);
      }
    }

    if (checkDir) {
      const resultsPath = join(checkDir, RESULTS_FILE);
      const limit = checks.reduce((sum, c) => sum + c.test.timeoutMs, 0) + CHECK_SLACK_MS;
      await runCheckProcess(deps, checkDir, mainClass, resultsPath, limit);
      let text = "";
      try {
        text = await readFile(resultsPath, "utf8");
      } catch {
        // no file: the program ended before the first test finished
      }
      const parsed = parseCheckResults(text);
      for (const { index, test } of checks) results[index] = checkResult(test as CheckTestCase, parsed.get(index));
    }
  } finally {
    await Promise.all(dirs.map(removeDir));
  }

  const final = results.map((r, i) => r ?? { name: tests[i]!.name, status: "error" as const, message: "Der Test wurde nicht ausgeführt." });
  return { started: true, results: final, summary: { passed: final.filter((r) => r.status === "passed").length, total: final.length } };
}
