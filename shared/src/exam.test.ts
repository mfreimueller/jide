import { describe, expect, it } from "vitest";
import { ExamConfigError, parseExamConfig } from "./index";

const msg = (raw: string): string => {
  try {
    parseExamConfig(raw);
  } catch (e) {
    expect(e).toBeInstanceOf(ExamConfigError);
    return (e as Error).message;
  }
  throw new Error("expected parseExamConfig to throw");
};

describe("parseExamConfig", () => {
  it("parses a full config", () => {
    expect(
      parseExamConfig(JSON.stringify({ mode: "exam", title: "POS Test", handInPath: "Q:\\x", jdkPath: "C:\\jdk", allowTests: false })),
    ).toEqual({ mode: "exam", title: "POS Test", handInPath: "Q:\\x", jdkPath: "C:\\jdk", allowTests: false });
  });

  it("applies defaults", () => {
    expect(parseExamConfig('{"mode":"exam","title":"T"}')).toEqual({
      mode: "exam",
      title: "T",
      handInPath: "P:\\",
      jdkPath: null,
      allowTests: true,
    });
  });

  it("accepts jdkPath null", () => {
    expect(parseExamConfig('{"mode":"exam","title":"T","jdkPath":null}').jdkPath).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(msg("{ nope")).toMatch(/^exam\.json ist kein gültiges JSON \(.+\)\.$/);
  });

  it("rejects a non-object", () => {
    expect(msg("[]")).toMatch(/^exam\.json ist ungültig: /);
    expect(msg("null")).toMatch(/^exam\.json ist ungültig: /);
  });

  it("requires mode exam", () => {
    expect(msg('{"title":"T"}')).toBe('exam.json ist ungültig: mode fehlt oder ist nicht "exam" (mode).');
    expect(msg('{"mode":"online","title":"T"}')).toBe('exam.json ist ungültig: mode fehlt oder ist nicht "exam" (mode).');
  });

  it("requires a non-empty title", () => {
    expect(msg('{"mode":"exam"}')).toBe("exam.json ist ungültig: title fehlt oder ist kein Text (title).");
    expect(msg('{"mode":"exam","title":3}')).toBe("exam.json ist ungültig: title fehlt oder ist kein Text (title).");
    expect(msg('{"mode":"exam","title":"  "}')).toBe("exam.json ist ungültig: title darf nicht leer sein (title).");
  });

  it("rejects a bad handInPath", () => {
    expect(msg('{"mode":"exam","title":"T","handInPath":""}')).toBe("exam.json ist ungültig: handInPath darf nicht leer sein (handInPath).");
    expect(msg('{"mode":"exam","title":"T","handInPath":5}')).toBe("exam.json ist ungültig: handInPath muss Text sein (handInPath).");
  });

  it("rejects a bad jdkPath", () => {
    expect(msg('{"mode":"exam","title":"T","jdkPath":7}')).toBe("exam.json ist ungültig: jdkPath muss Text oder null sein (jdkPath).");
  });

  it("rejects a bad allowTests", () => {
    expect(msg('{"mode":"exam","title":"T","allowTests":"yes"}')).toBe(
      "exam.json ist ungültig: allowTests muss true oder false sein (allowTests).",
    );
  });

  it("reports an unknown key first", () => {
    expect(msg('{"mode":"exam","titel":"T"}')).toBe('exam.json ist ungültig: Unbekannter Schlüssel "titel".');
    expect(msg('{"mode":"exam","title":"T","a":1,"b":2}')).toBe('exam.json ist ungültig: Unbekannter Schlüssel "a", "b".');
  });
});
