import { describe, expect, it } from "vitest";
import {
  bottomPanelVisible,
  chips,
  detach,
  detachTip,
  dock,
  effectiveBottomTab,
  panelOfTab,
  placeWindow,
  remainingBottomTabs,
  windowTitle,
  type DisplayInfo
} from "./panel-windows";

describe("detach / dock", () => {
  it("keeps the canonical order and no duplicates", () => {
    expect(detach(detach([], "tests"), "assign")).toEqual(["assign", "tests"]);
    expect(detach(["assign"], "assign")).toEqual(["assign"]);
  });
  it("docking removes only that panel; docking a docked panel changes nothing", () => {
    expect(dock(["assign", "tests"], "assign")).toEqual(["tests"]);
    expect(dock(["tests"], "code")).toEqual(["tests"]);
  });
});

describe("texts", () => {
  it("tooltip, chips and title", () => {
    expect(detachTip("console")).toBe("Konsole in eigenem Fenster öffnen");
    expect(chips(["tests", "assign"]).map((c) => c.text)).toEqual(["Angabe ↗", "Tests ↗"]);
    expect(chips(["code"])[0]?.tip).toBe(
      "Code ist in einem eigenen Fenster – Klick holt es nach vorne. Schließen holt es zurück."
    );
    expect(chips([])).toEqual([]);
    expect(windowTitle("assign", "Summe")).toBe("J;DE – Angabe – Summe");
  });
});

describe("bottom panel", () => {
  it("shows the remaining tabs; Tests only with tests", () => {
    expect(remainingBottomTabs([], true)).toEqual(["Konsole", "Probleme", "Tests"]);
    expect(remainingBottomTabs([], false)).toEqual(["Konsole", "Probleme"]);
    expect(remainingBottomTabs(["tests", "assign", "code"], true)).toEqual(["Konsole", "Probleme"]);
  });
  it("disappears when all tabs are detached", () => {
    expect(bottomPanelVisible(["console", "problems", "tests"], true)).toBe(false);
    expect(bottomPanelVisible(["console", "problems"], true)).toBe(true);
    // without tests, Konsole + Probleme are all there is
    expect(bottomPanelVisible(["console", "problems"], false)).toBe(false);
  });
  it("falls back to the first remaining tab", () => {
    expect(effectiveBottomTab("Konsole", ["console"], true)).toBe("Probleme");
    expect(effectiveBottomTab("Tests", [], true)).toBe("Tests");
    expect(panelOfTab("Probleme")).toBe("problems");
  });
});

describe("placeWindow", () => {
  const d1: DisplayInfo = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const d2: DisplayInfo = { id: 2, workArea: { x: 1920, y: 0, width: 1600, height: 900 } };
  const main = { x: 100, y: 50, width: 1280, height: 800 };

  it("reopens at the saved bounds while the display is connected", () => {
    const saved = { x: 2000, y: 100, width: 500, height: 500 };
    expect(placeWindow({ panel: "assign", saved, main, displays: [d1, d2] })).toEqual(saved);
  });
  it("ignores saved bounds of a display that is gone", () => {
    const saved = { x: 2000, y: 100, width: 500, height: 500 };
    const r = placeWindow({ panel: "assign", saved, main, displays: [d1] });
    expect(r).not.toEqual(saved);
  });
  it("first time: centred on a secondary display", () => {
    const r = placeWindow({ panel: "assign", main, displays: [d1, d2] });
    expect(r).toEqual({ x: 1920 + (1600 - 480) / 2, y: 100, width: 480, height: 700 });
  });
  it("shrinks to a small secondary display", () => {
    const small: DisplayInfo = { id: 3, workArea: { x: 1920, y: 0, width: 800, height: 600 } };
    const r = placeWindow({ panel: "code", main, displays: [d1, small] });
    expect(r.width).toBe(800);
    expect(r.height).toBe(600);
  });
  it("single display: right of the main window if it fits", () => {
    const m = { x: 0, y: 40, width: 1280, height: 800 };
    expect(placeWindow({ panel: "assign", main: m, displays: [d1] })).toEqual({ x: 1280, y: 40, width: 480, height: 700 });
  });
  it("single display: left of the main window if the right does not fit", () => {
    const m = { x: 700, y: 40, width: 1220, height: 800 };
    expect(placeWindow({ panel: "assign", main: m, displays: [d1] })).toEqual({ x: 220, y: 40, width: 480, height: 700 });
  });
  it("single display, main fills the screen: overlaps the right edge inside the screen", () => {
    const m = { x: 0, y: 0, width: 1920, height: 1080 };
    const r = placeWindow({ panel: "assign", main: m, displays: [d1] });
    expect(r.x + r.width).toBe(1920);
  });
});
