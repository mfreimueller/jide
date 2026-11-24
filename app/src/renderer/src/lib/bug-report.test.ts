import { describe, expect, it } from "vitest";
import { buildReport, clockTime, firstLineDiff, quoteLine, reportFileName, shortHash, type ReportInput } from "./bug-report";

// 2026-11-19 12:34:12 UTC = 13:34:12 in Vienna
const NOW = new Date(Date.UTC(2026, 10, 19, 12, 34, 12));
const RUN_AT = "2026-11-19T12:31:05.000Z";

const SRC = "class Summe {\n    int s = a + b;\n}\n";

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    now: NOW,
    env: { appVersion: "0.7.3", os: "Windows 11 (10.0.22631)", mode: "online", packageVersion: "3f2a91c0" },
    exerciseId: "06-summe",
    hasTests: true,
    allowTests: true,
    testState: "idle",
    programRunning: false,
    last: { at: RUN_AT, summary: { passed: 10, total: 10 }, snapshot: [{ path: "Summe.java", content: SRC }] },
    current: [{ path: "Summe.java", content: SRC }],
    decision: { reason: "ok", confirm: false, summary: { passed: 10, total: 10 } },
    events: [
      { at: "2026-11-19T12:30:58.000Z", text: "Testen gedrückt" },
      { at: "2026-11-19T12:31:05.000Z", text: "Testen fertig: 10 / 10 bestanden" }
    ],
    ...over
  };
}

describe("helpers", () => {
  it("shortHash is 8 hex digits and sensitive to whitespace", () => {
    expect(shortHash("")).toBe("811c9dc5");
    expect(shortHash("a")).toMatch(/^[0-9a-f]{8}$/);
    expect(shortHash("a")).not.toBe(shortHash("a "));
    expect(shortHash("a\n")).not.toBe(shortHash("a\r\n"));
  });
  it("quoteLine shows trailing spaces, tabs, \\r and invisible spaces", () => {
    expect(quoteLine("x = 1; ")).toBe('"x = 1; "');
    expect(quoteLine("\tx\r")).toBe('"\\tx\\r"');
    expect(quoteLine("a b")).toBe('"a\\u00a0b"');
    expect(quoteLine("Größe")).toBe('"Größe"');
    expect(quoteLine("x".repeat(500))).toContain("(gekürzt)");
  });
  it("firstLineDiff finds the first differing line, also a missing one", () => {
    expect(firstLineDiff("a\nb", "a\nb")).toBeUndefined();
    expect(firstLineDiff("a\nb\nc", "a\nB\nc")).toEqual({ line: 2, before: "b", after: "B" });
    expect(firstLineDiff("a\nb", "a\nb\nc")).toEqual({ line: 3, before: undefined, after: "c" });
    expect(firstLineDiff("a\nb\n", "a\r\nb\r\n")).toEqual({ line: 1, before: "a", after: "a\r" });
  });
  it("shows times in Vienna time and builds the file name from the exercise id", () => {
    expect(clockTime(RUN_AT)).toBe("13:31:05");
    expect(clockTime("kaputt")).toBe("?");
    expect(reportFileName("06-summe", NOW)).toBe("jde-fehlerbericht-06-summe-20261119-1334.txt");
  });
});

describe("buildReport", () => {
  it("unchanged code after a green run", () => {
    expect(buildReport(input())).toBe(
      [
        "J;DE Fehlerbericht – 19.11.2026 13:34:12 (12:34:12 UTC)",
        "App 0.7.3 · Windows 11 (10.0.22631) · Online-Modus",
        "Aufgabe 06-summe · Paket 3f2a91c0",
        "Tests: 10 · Testen erlaubt: ja",
        "Zustand: Testen idle · Programm läuft nein",
        "Letzter Testlauf: 13:31:05 · 10 / 10 bestanden",
        "Code seit dem Testlauf geändert: nein",
        `  Summe.java  unverändert ${SRC.length} Zeichen #${shortHash(SRC)}`,
        "Entscheidung: nicht nachfragen (alle Tests bestanden, Code unverändert), Ergebnis an Abgabe: 10 von 10",
        "Ereignisse:",
        "  13:30:58 Testen gedrückt",
        "  13:31:05 Testen fertig: 10 / 10 bestanden",
        ""
      ].join("\n")
    );
  });

  it("never tested", () => {
    const r = buildReport(
      input({ last: undefined, decision: { reason: "never-tested", confirm: true, summary: null }, events: [] })
    );
    expect(r).toContain("Tests: vorhanden (Anzahl unbekannt) · Testen erlaubt: ja");
    expect(r).toContain("Letzter Testlauf: keiner");
    expect(r).not.toContain("Code seit dem Testlauf");
    expect(r).toContain("Entscheidung: nachfragen (noch nie getestet), Ergebnis an Abgabe: keins");
    expect(r).toContain("Ereignisse:\n  (keine)");
  });

  it("failed last run on unchanged code", () => {
    const r = buildReport(
      input({
        last: { at: RUN_AT, summary: { passed: 7, total: 10 }, snapshot: [{ path: "Summe.java", content: SRC }] },
        decision: { reason: "failed", confirm: true, summary: { passed: 7, total: 10 } }
      })
    );
    expect(r).toContain("Letzter Testlauf: 13:31:05 · 7 / 10 bestanden");
    expect(r).toContain("Code seit dem Testlauf geändert: nein");
    expect(r).toContain("Entscheidung: nachfragen (letzter Testlauf nicht bestanden), Ergebnis an Abgabe: 7 von 10");
  });

  it("a whitespace-only change at line ends is not a change", () => {
    const now = SRC.replace("a + b;", "a + b; ") + "\n\n";
    const r = buildReport(input({ current: [{ path: "Summe.java", content: now }] }));
    expect(r).toContain("Code seit dem Testlauf geändert: nein");
    expect(r).toContain("  Summe.java  unverändert");
    expect(r).not.toContain("erste Abweichung");
  });

  it("changed code: a trailing space next to a real change is shown", () => {
    const now = SRC.replace("a + b;", "a + b + 1; ");
    const r = buildReport(
      input({ current: [{ path: "Summe.java", content: now }], decision: { reason: "changed", confirm: true, summary: null } })
    );
    expect(r).toContain("Code seit dem Testlauf geändert: ja");
    expect(r).toContain(`  Summe.java  Testlauf ${SRC.length} Zeichen #${shortHash(SRC)} → jetzt ${now.length} Zeichen #${shortHash(now)}`);
    expect(r).toContain("  erste Abweichung Zeile 2:");
    expect(r).toContain('    Testlauf: "    int s = a + b;"');
    expect(r).toContain('    jetzt:    "    int s = a + b + 1; "');
    expect(r).toContain("Entscheidung: nachfragen (Code geändert), Ergebnis an Abgabe: keins");
  });

  it("changed code: a CRLF file with a real change shows \\r", () => {
    const crlf = SRC.replace("a + b;", "a - b;").replace(/\n/g, "\r\n");
    const r = buildReport(input({ current: [{ path: "Summe.java", content: crlf }] }));
    expect(r).toContain("Code seit dem Testlauf geändert: ja");
    expect(r).toContain('    Testlauf: "class Summe {"');
    expect(r).toContain('    jetzt:    "class Summe {\\r"');
  });

  it("files added or missing since the run", () => {
    const r = buildReport(
      input({
        last: {
          at: RUN_AT,
          summary: { passed: 1, total: 1 },
          snapshot: [
            { path: "A.java", content: "a" },
            { path: "Weg.java", content: "xyz" }
          ]
        },
        current: [
          { path: "A.java", content: "a" },
          { path: "Neu.java", content: "12" }
        ]
      })
    );
    expect(r).toContain("Code seit dem Testlauf geändert: ja");
    expect(r).toContain(`  Neu.java  neu seit dem Testlauf: jetzt 2 Zeichen #${shortHash("12")}`);
    expect(r).toContain(`  Weg.java  fehlt jetzt: im Testlauf 3 Zeichen #${shortHash("xyz")}`);
  });

  it("states mode, state and a missing package version", () => {
    const r = buildReport(
      input({
        env: { appVersion: "0.7.3", os: "macOS (Darwin) 25.6.0", mode: "local", packageVersion: null },
        testState: "running",
        programRunning: true,
        allowTests: false,
        decision: undefined
      })
    );
    expect(r).toContain("· Lokaler Modus");
    expect(r).toContain("Aufgabe 06-summe\n");
    expect(r).toContain("Testen erlaubt: nein");
    expect(r).toContain("Zustand: Testen running · Programm läuft ja");
    expect(r).toContain("Entscheidung: noch keine");
  });
});
