import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { loadExercise, type CheckTestCase, type Exercise, type IoTestCase, type TestCase } from "@jide/shared";
import { HelperClient } from "./helper";
import {
  EARLY_EXIT_MESSAGE,
  MAIN_CLASH_MESSAGE,
  OUTPUT_LIMIT_MESSAGE,
  TIMEOUT_MESSAGE,
  declaresMainWithArgs,
  generateCheckCode,
  checkResult,
  READ_TOO_MUCH_HINT,
  ioResult,
  parseCheckResults,
  runTests,
  type TestOutcome
} from "./test-runner";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const jar = resolve(root, "java-helper", "target", "java-helper.jar");
const hasJava = spawnSync("java", ["-version"]).status === 0;
const integration = hasJava && existsSync(jar);

describe("declaresMainWithArgs", () => {
  it("detects the usual spellings", () => {
    expect(declaresMainWithArgs("void main(String[] args) {}")).toBe(true);
    expect(declaresMainWithArgs("public static void main(String args[]) {}")).toBe(true);
    expect(declaresMainWithArgs("static void main(final String... a) {}")).toBe(true);
  });
  it("ignores void main() and comments", () => {
    expect(declaresMainWithArgs("void main() {}")).toBe(false);
    expect(declaresMainWithArgs("// void main(String[] args)\nvoid main() {}")).toBe(false);
    expect(declaresMainWithArgs("/* void main(String[] args) */ int x;")).toBe(false);
  });
});

describe("generated check code", () => {
  it("numbers the tests and keeps teacher text verbatim", () => {
    const t1: CheckTestCase = { type: "check", name: "a", call: "f(1)", expected: "1", timeoutMs: 700 };
    const t2: CheckTestCase = { type: "check", name: "b", code: "return true;", timeoutMs: 900 };
    const code = generateCheckCode([{ index: 3, test: t1 }, { index: 5, test: t2 }], "A.java", 7);
    expect(code).toContain("__jideRun(__jideW, 3, false, 700L, () -> (Object) (\nf(1)\n));");
    expect(code).toContain("__jideRun(__jideW, 5, true, 900L, () -> {\nreturn true;\n});");
    expect(code).toContain('__jideFile = "A.java"');
  });
  it("parses and unescapes result lines", () => {
    const m = parseCheckResults("0\tval\ta\\tb\\nc\\\\d\t\n1\terr\tboom\t12\n");
    expect(m.get(0)?.payload).toBe("a\tb\nc\\d");
    expect(m.get(1)).toMatchObject({ kind: "err", line: 12 });
  });
});

describe("checkResult val", () => {
  const t = (expected: string): CheckTestCase => ({ type: "check", name: "n", call: "f()", expected, timeoutMs: 1000 });
  const val = (payload: string) => ({ index: 0, kind: "val", payload });
  it("treats a comma and a dot between digits as equal", () => {
    expect(checkResult(t("3.14"), val("3,14")).status).toBe("passed");
    expect(checkResult(t("3,14"), val("3.14")).status).toBe("passed");
    expect(checkResult(t("3.14"), val(" 3.14\n")).status).toBe("passed");
  });
  it("still fails on different digits", () => {
    expect(checkResult(t("3.14"), val("3,15")).status).toBe("failed");
    expect(checkResult(t("3.14"), val("3,1")).status).toBe("failed");
    expect(checkResult(t("a.b"), val("a,b")).status).toBe("failed");
  });
});

describe("ioResult hint for reading too much input", () => {
  const test: IoTestCase = { type: "io", name: "n", input: "a\n", expected: "x", match: "contains", timeoutMs: 1000 };
  const run = (stderr: string) => ({ stdout: "", stderr, timedOut: false, limitHit: false });
  const scannerTrace = `Exception in thread "main" java.util.NoSuchElementException: No line found
\tat java.base/java.util.Scanner.nextLine(Scanner.java:1660)
\tat Main.main(Main.java:5)
`;
  it("is set for a NoSuchElementException thrown by Scanner", () => {
    const r = ioResult(test, run(scannerTrace), "Main.java", 10);
    expect(r).toMatchObject({ status: "error", line: 5, hint: READ_TOO_MUCH_HINT });
    expect(r.message).not.toContain("Läuft deine Schleife");
    expect(READ_TOO_MUCH_HINT).toBe("Dein Programm wollte mehr Eingaben lesen, als der Test liefert. Läuft deine Schleife zu oft?");
  });
  it("is absent for other exceptions, even with a Scanner frame", () => {
    const other = `Exception in thread "main" java.util.InputMismatchException\n\tat java.base/java.util.Scanner.throwFor(Scanner.java:939)\n\tat Main.main(Main.java:5)\n`;
    expect(ioResult(test, run(other), "Main.java", 10)).not.toHaveProperty("hint");
  });
  it("is absent for a NoSuchElementException that does not come from Scanner", () => {
    const iter = `Exception in thread "main" java.util.NoSuchElementException\n\tat java.base/java.util.ArrayList$Itr.next(ArrayList.java:1052)\n\tat Main.main(Main.java:5)\n`;
    expect(ioResult(test, run(iter), "Main.java", 10)).not.toHaveProperty("hint");
  });
});

const SUMME_OK = `void main() {
    Scanner sc = new Scanner(System.in);
    int a = sc.nextInt();
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

const MAX_OK = `int maximum(int a, int b) {
    if (a > b) return a;
    return b;
}
`;

const io = (name: string, input: string, expected: string, timeoutMs = 3000): IoTestCase => ({
  type: "io",
  name,
  input,
  expected,
  match: "contains",
  timeoutMs
});
const call = (name: string, c: string, expected: string, timeoutMs = 3000): CheckTestCase => ({
  type: "check",
  name,
  call: c,
  expected,
  timeoutMs
});

describe.skipIf(!integration)("runTests (real helper and JDK)", () => {
  const helper = new HelperClient("java", jar);
  afterAll(() => helper.shutdown());
  const deps = { compile: (r: Parameters<HelperClient["compile"]>[0]) => helper.compile(r), javaPath: "java" };

  async function summe(tests: TestCase[]): Promise<Exercise> {
    return { ...(await loadExercise(resolve(root, "examples", "summe"))), tests };
  }
  async function maximum(tests: TestCase[]): Promise<Exercise> {
    return { ...(await loadExercise(resolve(root, "examples", "maximum"))), tests };
  }
  const run = (ex: Exercise, path: string, content: string): Promise<TestOutcome> =>
    runTests(ex, [{ path, content }], deps);
  function started(o: TestOutcome) {
    if (!o.started) throw new Error("expected a run, got diagnostics: " + JSON.stringify(o.diagnostics));
    return o;
  }

  it("io: pass", async () => {
    const o = started(await run(await summe([io("3+4", "3\n4\n", "Summe: 7")]), "Summe.java", SUMME_OK));
    expect(o.results).toEqual([{ name: "3+4", status: "passed" }]);
    expect(o.summary).toEqual({ passed: 1, total: 1 });
  });

  it("io: fail shows expected and actual", async () => {
    const wrong = SUMME_OK.replace("a + b", "a - b");
    const o = started(await run(await summe([io("3+4", "3\n4\n", "Summe: 7")]), "Summe.java", wrong));
    expect(o.results[0]).toMatchObject({ status: "failed", expected: "Summe: 7" });
    expect(o.results[0]!.actual).toContain("Summe: -1");
    expect(o.summary).toEqual({ passed: 0, total: 1 });
  });

  it("io: uncaught exception with the line in the student's file", async () => {
    const src = SUMME_OK.replace("a + b", "a / (b - b)");
    const o = started(await run(await summe([io("x", "3\n4\n", "Summe")]), "Summe.java", src));
    expect(o.results[0]).toMatchObject({ status: "error", line: 5 });
    expect(o.results[0]!.message).toContain("java.lang.ArithmeticException: / by zero");
    expect(o.results[0]!.message).toContain("(Zeile 5)");
  });

  it("io: endless loop times out", async () => {
    const src = "void main() {\n    while (true) { }\n}\n";
    const o = started(await run(await summe([io("loop", "", "x", 500)]), "Summe.java", src));
    expect(o.results[0]).toMatchObject({ status: "error", message: TIMEOUT_MESSAGE });
  });

  it("io: too much output stops the program", async () => {
    const src = 'void main() {\n    while (true) { System.out.println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"); }\n}\n';
    const o = started(await run(await summe([io("flood", "", "x", 10000)]), "Summe.java", src));
    expect(o.results[0]).toMatchObject({ status: "error", message: OUTPUT_LIMIT_MESSAGE });
  });

  it("compile error in the student's code: diagnostics, no run", async () => {
    const o = await run(await summe([io("a", "1\n2\n", "3")]), "Summe.java", "void main() {\n    int x = ;\n}\n");
    expect(o.started).toBe(false);
    if (!o.started) {
      expect(o.diagnostics.some((d) => d.severity === "error" && d.origin === "student" && d.line === 2)).toBe(true);
    }
  });

  it("check: pass, with temp dirs cleaned up", async () => {
    const before = readdirSync(tmpdir()).filter((n) => n.startsWith("jide-test-")).length;
    const tests = [call("m1", "maximum(3, 7)", "7"), call("m2", "maximum(-4, -8)", "-4")];
    const o = started(await run(await maximum(tests), "Maximum.java", MAX_OK));
    expect(o.results.map((r) => r.status)).toEqual(["passed", "passed"]);
    expect(o.summary).toEqual({ passed: 2, total: 2 });
    expect(readdirSync(tmpdir()).filter((n) => n.startsWith("jide-test-")).length).toBe(before);
  });

  it("check: fail shows expected and actual", async () => {
    const o = started(await run(await maximum([call("m", "maximum(3, 7)", "7")]), "Maximum.java", "int maximum(int a, int b) {\n    return a;\n}\n"));
    expect(o.results[0]).toEqual({ name: "m", status: "failed", expected: "7", actual: "3" });
  });

  it("check: exception with line number", async () => {
    const src = "int maximum(int a, int b) {\n    int[] x = new int[1];\n    return x[5];\n}\n";
    const o = started(await run(await maximum([call("m", "maximum(3, 7)", "7")]), "Maximum.java", src));
    expect(o.results[0]).toMatchObject({ status: "error", line: 3 });
    expect(o.results[0]!.message).toContain("ArrayIndexOutOfBoundsException");
    expect(o.results[0]!.message).toContain("(Zeile 3)");
  });

  it("check: an endless loop times out, the other tests still get results", async () => {
    const src = "int maximum(int a, int b) {\n    if (a == 5) { while (true) { } }\n    return Math.max(a, b);\n}\n";
    const tests = [call("a", "maximum(1, 2)", "2"), call("loop", "maximum(5, 5)", "5", 500), call("b", "maximum(9, 2)", "9")];
    const o = started(await run(await maximum(tests), "Maximum.java", src));
    expect(o.results.map((r) => r.status)).toEqual(["passed", "error", "passed"]);
    expect(o.results[1]!.message).toBe(TIMEOUT_MESSAGE);
    expect(o.summary).toEqual({ passed: 2, total: 3 });
  });

  it("check: code block, returning true and false", async () => {
    const tests: TestCase[] = [
      { type: "check", name: "ok", code: "int m = maximum(2, 8);\nreturn m == 8;", timeoutMs: 3000 },
      { type: "check", name: "no", code: "return maximum(2, 8) == 2;", timeoutMs: 3000 },
      call("array", "new int[] {1, 2}", "[1, 2]"),
      call("null", "(String) null", "null")
    ];
    const o = started(await run(await maximum(tests), "Maximum.java", MAX_OK));
    expect(o.results.map((r) => r.status)).toEqual(["passed", "failed", "passed", "passed"]);
  });

  it("check: System.exit in the student's code", async () => {
    const src = "int maximum(int a, int b) {\n    if (a == 0) System.exit(3);\n    return Math.max(a, b);\n}\n";
    const tests = [call("a", "maximum(1, 2)", "2"), call("exit", "maximum(0, 1)", "1"), call("c", "maximum(4, 2)", "4")];
    const o = started(await run(await maximum(tests), "Maximum.java", src));
    expect(o.results.map((r) => r.status)).toEqual(["passed", "error", "error"]);
    expect(o.results[1]!.message).toBe(EARLY_EXIT_MESSAGE);
  });

  it("check: compile error in the student's code", async () => {
    const o = await run(await maximum([call("a", "maximum(1, 2)", "2")]), "Maximum.java", "int maximum(int a, int b) {\n    return a +;\n}\n");
    expect(o.started).toBe(false);
  });

  it("check: a broken call is reported as Fehler im vorgegebenen Code", async () => {
    const tests = [call("broken", "maximum(1,", "2"), io("harness", "", "maximum(3, 7) = 7")];
    const o = started(await run(await maximum(tests), "Maximum.java", MAX_OK));
    expect(o.results[0]!.status).toBe("error");
    expect(o.results[0]!.message).toContain("Fehler im vorgegebenen Code");
    // the io test uses the exercise's own harness and is not affected
    expect(o.results[1]).toMatchObject({ status: "passed" });
  });

  it("check: a main(String[] args) in the student's file", async () => {
    const src = MAX_OK + "\nvoid main(String[] args) {\n}\n";
    const o = started(await run(await maximum([call("a", "maximum(1, 2)", "2")]), "Maximum.java", src));
    expect(o.results[0]).toEqual({ name: "a", status: "error", message: MAIN_CLASH_MESSAGE });
  });

  it("mixes io and check tests in the order of tests.yaml", async () => {
    const tests = [call("c1", "maximum(1, 2)", "2"), io("i1", "", "maximum(3, 7) = 7"), call("c2", "maximum(1, 2)", "1")];
    const o = started(await run(await maximum(tests), "Maximum.java", MAX_OK));
    expect(o.results.map((r) => [r.name, r.status])).toEqual([["c1", "passed"], ["i1", "passed"], ["c2", "failed"]]);
  });
});
