import { describe, expect, it } from "vitest";
import { assignmentHeading, handInToast, saveStatusView, startFooter, stripLeadingHeading, tabLabel } from "./exam-ui";

describe("exam-ui", () => {
  it("startFooter: plural, singular and allowTests", () => {
    expect(startFooter(2, true)).toBe("2 Aufgaben · Testen ist erlaubt");
    expect(startFooter(1, true)).toBe("1 Aufgabe · Testen ist erlaubt");
    expect(startFooter(3, false)).toBe("3 Aufgaben · Testen ist nicht erlaubt");
  });

  it("tabLabel and assignmentHeading count from 1", () => {
    expect(tabLabel(0)).toBe("Aufgabe 1");
    expect(assignmentHeading(1, "Größere Zahl")).toBe("Aufgabe 2: Größere Zahl");
  });

  it("stripLeadingHeading removes only a leading h1", () => {
    expect(stripLeadingHeading("# Titel\n\nText\n\n## Beispiel\n", "Titel")).toBe("Text\n\n## Beispiel\n");
    expect(stripLeadingHeading("# Titel\r\n\r\nText", "Titel")).toBe("Text");
    expect(stripLeadingHeading("Text\n# Später", "Später")).toBe("Text\n# Später");
    expect(stripLeadingHeading("## Kein h1\nText", "Kein h1")).toBe("## Kein h1\nText");
    expect(stripLeadingHeading("# Nur Titel", "Nur Titel")).toBe("");
    // a different first heading is the teacher's own and stays
    expect(stripLeadingHeading("# Hinweis\nText", "Titel")).toBe("# Hinweis\nText");
  });

  it("saveStatusView: nothing before the first save, green after a success, amber after a failure", () => {
    expect(saveStatusView(undefined, "P:\\")).toBeUndefined();
    // 2026-12-03 09:44 UTC = 10:44 in Vienna
    expect(saveStatusView({ ok: true, at: "2026-12-03T09:44:12Z" }, "P:\\")).toEqual({
      tone: "ok",
      text: "● zuletzt gesichert auf P:\\ um 10:44"
    });
    expect(saveStatusView({ ok: false, at: "2026-12-03T09:45:12Z" }, "P:\\")).toEqual({
      tone: "warn",
      text: "● P:\\ nicht erreichbar – deine Arbeit ist nur auf diesem PC gesichert"
    });
  });

  it("handInToast", () => {
    expect(handInToast("P:\\", "2026-12-03T09:44:12Z")).toBe("Abgabe gespeichert auf P:\\ – 10:44");
  });
});
