import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lookupJdk, majorOf, parseJavaProperties, searchedLines, type JdkEnv, type ProbeResult } from "./jdk";

const out = (home: string, spec: string, version = spec): ProbeResult => ({
  kind: "output",
  text: `Property settings:\n    java.home = ${home}\n    java.specification.version = ${spec}\n    java.version = ${version}\nopenjdk version "${version}"\n`
});
const old = (home: string): ProbeResult => ({
  kind: "output",
  text: `Property settings:\n    java.home = ${home}\n    java.specification.version = 1.8\n    java.version = 1.8.0_402\n`
});

const JDK = join("jdks", "25");
const ex = (...paths: string[]) => new Set(paths);

function env(over: Partial<JdkEnv> & { results?: Record<string, ProbeResult>; present?: Set<string> }): JdkEnv & { calls: string[] } {
  const calls: string[] = [];
  return {
    jdkPath: null,
    javaHome: undefined,
    platform: "linux",
    exists: (p) => (over.present ?? new Set()).has(p),
    run: async (exe) => {
      calls.push(exe);
      return over.results?.[exe] ?? { kind: "not-found" };
    },
    ...over,
    calls
  } as JdkEnv & { calls: string[] };
}

describe("parseJavaProperties / majorOf", () => {
  it("reads home and major", () => {
    expect(parseJavaProperties((out("/x/jdk", "25") as { text: string }).text)).toEqual({ home: "/x/jdk", major: 25 });
    expect(parseJavaProperties((out("/x", "27", "27-ea") as { text: string }).text).major).toBe(27);
  });
  it("handles Java 1.8", () => {
    expect(parseJavaProperties((old("/x") as { text: string }).text).major).toBe(8);
    expect(majorOf("1.8.0_402")).toBe(8);
    expect(majorOf("25.0.1")).toBe(25);
    expect(majorOf("27-ea")).toBe(27);
    expect(majorOf("")).toBeUndefined();
    expect(majorOf("abc")).toBeUndefined();
  });
  it("falls back to java.version", () => {
    expect(parseJavaProperties("    java.home = /h\n    java.version = 21.0.2\n")).toEqual({ home: "/h", major: 21 });
  });
  it("returns nothing for garbage", () => {
    expect(parseJavaProperties("hello")).toEqual({});
  });
});

describe("lookupJdk", () => {
  const javaIn = (root: string) => join(root, "bin", "java");
  const javacIn = (root: string) => join(root, "bin", "javac");

  it("accepts Java 25 from jdkPath and stops there", async () => {
    const e = env({
      jdkPath: JDK,
      javaHome: "/jh",
      present: ex(JDK, javaIn(JDK), javacIn(JDK)),
      results: { [javaIn(JDK)]: out(JDK, "25") }
    });
    const r = await lookupJdk(e);
    expect(r.java).toBe(javaIn(JDK));
    expect(e.calls).toEqual([javaIn(JDK)]);
  });

  it("accepts Java 27 from JAVA_HOME when jdkPath is not set", async () => {
    const e = env({ javaHome: "/jh", present: ex("/jh", javaIn("/jh"), javacIn("/jh")), results: { [javaIn("/jh")]: out("/jh", "27") } });
    const r = await lookupJdk(e);
    expect(r.java).toBe(javaIn("/jh"));
    expect(r.jdkPath.outcome).toBe("nicht gesetzt");
  });

  it("uses java on the PATH last", async () => {
    const e = env({ results: { java: out("/p", "26") }, present: ex(javacIn("/p")) });
    expect((await lookupJdk(e)).java).toBe("java");
  });

  it("falls through to the next candidate when one is too old", async () => {
    const e = env({
      jdkPath: JDK,
      javaHome: "/jh",
      present: ex(JDK, javaIn(JDK), "/jh", javaIn("/jh"), javacIn("/jh")),
      results: { [javaIn(JDK)]: out(JDK, "21"), [javaIn("/jh")]: out("/jh", "25") }
    });
    const r = await lookupJdk(e);
    expect(r.java).toBe(javaIn("/jh"));
    expect(r.jdkPath).toEqual({ value: JDK, outcome: "Java 21, zu alt" });
  });

  it("reports Java 21, Java 1.8, a JRE, a spawn error and a timeout", async () => {
    const e = env({
      jdkPath: JDK,
      javaHome: "/jh",
      present: ex(JDK, javaIn(JDK), "/jh", javaIn("/jh")),
      results: { [javaIn(JDK)]: old(JDK), [javaIn("/jh")]: out("/jh", "25"), java: { kind: "timeout" } }
    });
    const r = await lookupJdk(e);
    expect(r.java).toBeUndefined();
    expect(r.jdkPath.outcome).toBe("Java 8, zu alt");
    expect(r.javaHome.outcome).toBe("nur Java-Laufzeit (JRE), kein JDK"); // no javac
    expect(r.path.outcome).toBe("konnte nicht gestartet werden");

    const e2 = env({ results: { java: { kind: "error" } } });
    expect((await lookupJdk(e2)).path.outcome).toBe("konnte nicht gestartet werden");
    const e3 = env({ results: { java: out("/x", "21") } });
    expect((await lookupJdk(e3)).path.outcome).toBe("Java 21, zu alt");
  });

  it("reports missing folders, missing java and unreadable output", async () => {
    const r = await lookupJdk(env({ jdkPath: "/none", javaHome: "/empty", present: ex("/empty") }));
    expect(r.java).toBeUndefined();
    expect(r.jdkPath).toEqual({ value: "/none", outcome: "Ordner nicht gefunden" });
    expect(r.javaHome).toEqual({ value: "/empty", outcome: "kein java gefunden" });
    expect(r.path.outcome).toBe("kein java gefunden");
    const r2 = await lookupJdk(env({ results: { java: { kind: "output", text: "boom" } } }));
    expect(r2.path.outcome).toBe("Java-Version nicht erkennbar");
  });

  it("uses .exe names on Windows", async () => {
    const root = "C:\\jdk";
    const java = join(root, "bin", "java.exe");
    const e = env({ platform: "win32", jdkPath: root, present: ex(root, java, join(root, "bin", "javac.exe")), results: { [java]: out(root, "25") } });
    expect((await lookupJdk(e)).java).toBe(java);
  });

  it("formats the lines of screen 10", async () => {
    const r = await lookupJdk(env({ javaHome: "/empty", present: ex("/empty") }));
    expect(searchedLines(r)).toEqual([
      "jdkPath (exam.json): nicht gesetzt",
      "JAVA_HOME: /empty",
      "  → kein java gefunden",
      "PATH: kein java gefunden"
    ]);
    const r2 = await lookupJdk(env({}));
    expect(searchedLines(r2)[1]).toBe("JAVA_HOME: nicht gesetzt");
  });
});
