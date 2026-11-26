import { describe, expect, it } from "vitest";
import { decideNewerHandIn, hashFiles, normaliseCode, type RemoteHandIn } from "./handin-sync";

const f = (content: string, path = "Main.java") => ({ path, content });
const starter = [f("// start\n")];
const hand = (content: string, at = "2026-11-25T10:00:00.000Z"): RemoteHandIn => ({ submittedAt: at, late: false, files: [f(content)] });
const decide = (i: Partial<Parameters<typeof decideNewerHandIn>[0]>) =>
  decideNewerHandIn({ latest: hand("// desktop\n"), known: null, local: starter, starter, ...i });

describe("decideNewerHandIn", () => {
  it("nothing when there is no hand-in or it could not be fetched (offline)", () => {
    expect(decide({ latest: null })).toBe("none");
  });

  it("nothing when this device already knows exactly this hand-in", () => {
    const known = { submittedAt: "2026-11-25T10:00:00.000Z", late: false, base: hashFiles([f("x")]) };
    expect(decide({ known, local: [f("changed")] })).toBe("none");
  });

  it("only records when the local files equal the hand-in (normalised)", () => {
    expect(decide({ local: [f("// desktop  \r\n\r\n")] })).toBe("record");
  });

  it("replaces when the local files are unchanged since the sync point", () => {
    const local = [f("// laptop\n")];
    const known = { submittedAt: "2026-11-20T10:00:00.000Z", late: false, base: hashFiles(local) };
    expect(decide({ known, local })).toBe("replace");
    // Only whitespace noise since the sync point is no change.
    expect(decide({ known, local: [f("// laptop   \n\n")] })).toBe("replace");
  });

  it("asks when the local files changed since the sync point", () => {
    const known = { submittedAt: "2026-11-20T10:00:00.000Z", late: false, base: hashFiles([f("// laptop\n")]) };
    expect(decide({ known, local: [f("// laptop 2\n")] })).toBe("ask");
  });

  it("never synced: unchanged starter files are replaced, own code is asked about", () => {
    expect(decide({ known: null, local: starter })).toBe("replace");
    expect(decide({ known: null, local: [f("// mine\n")] })).toBe("ask");
  });

  it("legacy entry without sync point: starter files replace, anything else asks (also when it equals the old hand-in)", () => {
    const known = { submittedAt: "2026-11-20T10:00:00.000Z", late: false };
    expect(decide({ known, local: starter })).toBe("replace");
    expect(decide({ known, local: [f("// the old hand-in\n")] })).toBe("ask");
  });

  it("'Meinen Stand behalten' records the hand-in without touching the sync point, so it is not asked again", () => {
    const base = hashFiles([f("// laptop\n")]);
    const local = [f("// laptop 2\n")];
    const first = decide({ known: { submittedAt: "2026-11-20T10:00:00.000Z", late: false, base }, local });
    expect(first).toBe("ask");
    const kept = { submittedAt: "2026-11-25T10:00:00.000Z", late: false, base };
    expect(decide({ known: kept, local })).toBe("none");
    // A still newer hand-in asks again.
    expect(decide({ known: kept, local, latest: hand("// later\n", "2026-11-26T10:00:00.000Z") })).toBe("ask");
  });

  it("compares only the files the hand-in has", () => {
    const two = [f("a\n", "A.java"), f("b\n", "B.java")];
    const latest: RemoteHandIn = { submittedAt: "2026-11-25T10:00:00.000Z", late: false, files: [f("a\n", "A.java")] };
    expect(decide({ latest, local: two, starter: two })).toBe("record");
  });
});

describe("hashFiles / normaliseCode", () => {
  it("ignores order, line endings, trailing blanks; not inner blank lines or indentation", () => {
    const a = [f("x\r\n", "A.java"), f("y", "B.java")];
    const b = [f("y  \n\n", "B.java"), f("x", "A.java")];
    expect(hashFiles(a)).toBe(hashFiles(b));
    expect(hashFiles([f("a\n\nb")])).not.toBe(hashFiles([f("a\nb")]));
    expect(hashFiles([f("  a")])).not.toBe(hashFiles([f("a")]));
    expect(normaliseCode("a \t\r\nb\n\n")).toBe("a\nb");
  });
});
