import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { detectExamMode, examPaths } from "./exam-mode";

const files = (map: Record<string, string>) => (p: string) => {
  if (p in map) return map[p]!;
  throw new Error("ENOENT");
};

describe("detectExamMode", () => {
  const execPath = join("share", "JDE-Exam", "JDE.exe");
  const examJson = join("share", "JDE-Exam", "exam.json");

  it("packaged: exam.json next to the exe switches exam mode on", () => {
    const m = detectExamMode({
      isPackaged: true,
      execPath,
      readText: files({ [examJson]: '{"mode":"exam","title":"Probe"}' })
    });
    expect(m).toEqual({
      dir: join("share", "JDE-Exam"),
      exercisesDir: join("share", "JDE-Exam", "exercises"),
      title: "Probe"
    });
  });

  it("packaged: no exam.json means online mode", () => {
    expect(detectExamMode({ isPackaged: true, execPath, readText: files({}) })).toBeUndefined();
  });

  it("packaged: the title is optional and a broken file is still exam mode", () => {
    expect(detectExamMode({ isPackaged: true, execPath, readText: files({ [examJson]: "{}" }) })?.title).toBeUndefined();
    expect(detectExamMode({ isPackaged: true, execPath, readText: files({ [examJson]: "{kaputt" }) })).toBeDefined();
    expect(detectExamMode({ isPackaged: true, execPath, readText: files({ [examJson]: '{"title":5}' }) })?.title).toBeUndefined();
  });

  it("packaged: the environment override is ignored", () => {
    expect(
      detectExamMode({ isPackaged: true, execPath, examDirOverride: "other", readText: files({ [join("other", "exam.json")]: "{}" }) })
    ).toBeUndefined();
  });

  it("unpackaged: only JIDE_EXAM_DIR switches it on, and only with an exam.json in it", () => {
    const readText = files({ [join("dev", "exam.json")]: "{}" });
    expect(detectExamMode({ isPackaged: false, execPath: "electron", readText })).toBeUndefined();
    expect(detectExamMode({ isPackaged: false, execPath: "electron", examDirOverride: "dev", readText })?.exercisesDir).toBe(
      join("dev", "exercises")
    );
    expect(detectExamMode({ isPackaged: false, execPath: "electron", examDirOverride: "leer", readText })).toBeUndefined();
  });
});

describe("examPaths", () => {
  it("puts everything below <tmp>/JDE-exam", () => {
    const p = examPaths("tmp");
    const root = join("tmp", "JDE-exam");
    for (const v of Object.values(p)) expect(v.startsWith(root + sep)).toBe(true);
    expect(new Set(Object.values(p)).size).toBe(5);
  });

  it("JIDE_USER_DATA_DIR wins and keeps everything below it", () => {
    const p = examPaths("tmp", "ud");
    expect(p.userData).toBe("ud");
    for (const v of Object.values(p)) expect(v.startsWith("ud")).toBe(true);
  });
});
