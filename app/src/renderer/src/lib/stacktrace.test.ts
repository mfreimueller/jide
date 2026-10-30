import { describe, expect, it } from "vitest";
import { findStackLinks } from "./stacktrace";

const files = [
  { path: "Summe.java", lineCount: 10 },
  { path: "Person.java", lineCount: 4 }
];

describe("findStackLinks", () => {
  it("links the location of a stack frame", () => {
    const line = "\tat Summe.main(Summe.java:7)";
    const [link] = findStackLinks(line, files);
    expect(link).toMatchObject({ path: "Summe.java", line: 7, length: "Summe.java:7".length });
    expect(line.slice(link!.start, link!.start + link!.length)).toBe("Summe.java:7");
  });

  it("ignores lines that are not stack frames", () => {
    expect(findStackLinks('Exception in thread "main" java.lang.Error (Summe.java:7)', files)).toEqual([]);
    expect(findStackLinks("Summe: 7", files)).toEqual([]);
  });

  it("ignores files that are not part of the exercise (JDK frames)", () => {
    expect(findStackLinks("\tat java.base/java.util.Scanner.throwFor(Scanner.java:1000)", files)).toEqual([]);
  });

  it("ignores lines behind the student's code (harness)", () => {
    expect(findStackLinks("\tat Summe.main(Summe.java:11)", files)).toEqual([]);
    expect(findStackLinks("\tat Summe.main(Summe.java:10)", files)).toHaveLength(1);
    expect(findStackLinks("\tat Person.<init>(Person.java:0)", files)).toEqual([]);
  });

  it("works for frames with module prefixes and several locations", () => {
    const links = findStackLinks("  at Person.name(Person.java:2) (Summe.java:3)", files);
    expect(links.map((l) => [l.path, l.line])).toEqual([
      ["Person.java", 2],
      ["Summe.java", 3]
    ]);
  });
});
