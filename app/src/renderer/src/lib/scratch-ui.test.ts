import { describe, expect, it } from "vitest";
import { canDeleteClass, classCountLabel, importedLine, scratchLine } from "./scratch-ui";

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

  it("never offers to delete a class of an imported exercise", () => {
    expect(canDeleteClass("Hilfe.java", "Summe.java", ["Summe.java", "Hilfe.java"])).toBe(false);
    expect(canDeleteClass("Extra.java", "Summe.java", ["Summe.java", "Hilfe.java"])).toBe(true);
  });

  it("builds the line of an imported card", () => {
    expect(importedLine(3)).toBe("Importiert · 3 Tests");
    expect(importedLine(1)).toBe("Importiert · 1 Test");
    expect(importedLine(0)).toBe("Importiert · keine Tests");
    expect(importedLine(3, true)).toBe("Kopie · 3 Tests");
    expect(importedLine(0, true)).toBe("Kopie · keine Tests");
  });
});
