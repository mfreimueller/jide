import { describe, expect, it } from "vitest";
import { canDeleteClass, classCountLabel, scratchLine } from "./scratch-ui";

describe("scratch-ui", () => {
  it("uses singular and plural", () => {
    expect(classCountLabel(1)).toBe("1 Klasse");
    expect(classCountLabel(2)).toBe("2 Klassen");
    expect(classCountLabel(0)).toBe("0 Klassen");
  });

  it("builds the card line", () => {
    expect(scratchLine(1)).toBe("Eigenes Programm · 1 Klasse");
    expect(scratchLine(3)).toBe("Eigenes Programm · 3 Klassen");
  });

  it("never offers to delete the main file", () => {
    expect(canDeleteClass("Main.java", "Main.java")).toBe(false);
    expect(canDeleteClass("Main.java", "Start.java")).toBe(false);
    expect(canDeleteClass("Start.java", "Start.java")).toBe(false);
    expect(canDeleteClass("Rechner.java", "Main.java")).toBe(true);
  });
});
