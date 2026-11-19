import type { ReportEnv, SourceFileInput } from "../../../shared-types/api";
import type { LogEvent } from "./event-log";
import type { HandInReason } from "./test-state";

// Bug report text (T44). Pure: everything it shows is passed in. It never contains whole files, the
// access code or other secrets: only lengths, short hashes and the first line that differs.

const ZONE = "Europe/Vienna";
const MAX_LINE = 200;
/** DEL, no-break and other Unicode spaces, zero-width and BOM characters: they look like nothing or like a space. */
function invisible(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 0x7f && c <= 0xa0) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202f) || c === 0x2060 || c === 0xfeff;
}

const viennaFormat = new Intl.DateTimeFormat("de-AT", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

function viennaParts(d: Date): Record<string, string> {
  const r: Record<string, string> = {};
  for (const p of viennaFormat.formatToParts(d)) r[p.type] = p.value;
  return r;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "13:31:05" in Vienna time; "?" for an unreadable date. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  const p = viennaParts(d);
  return `${p["hour"]}:${p["minute"]}:${p["second"]}`;
}

/** 32-bit FNV-1a over the UTF-16 code units, 8 hex digits: enough to tell two file versions apart. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** JSON-style quoting so tabs, \r and trailing spaces are visible; invisible Unicode spaces are escaped too. */
export function quoteLine(s: string): string {
  let q = "";
  for (const ch of JSON.stringify(s)) q += invisible(ch) ? `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}` : ch;
  if (q.length > MAX_LINE) q = `${q.slice(0, MAX_LINE)}… (gekürzt)`;
  return q;
}

export interface LineDiff {
  /** 1-based. */
  line: number;
  before: string | undefined;
  after: string | undefined;
}

/** First line (split at \n only, so a \r stays visible) where the two texts differ; undefined if equal. */
export function firstLineDiff(before: string, after: string): LineDiff | undefined {
  if (before === after) return undefined;
  const a = before.split("\n");
  const b = after.split("\n");
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { line: i + 1, before: a[i], after: b[i] };
  }
  return undefined;
}

/** "19.11.2026 13:34:12 (12:34:12 UTC)" */
function stamp(now: Date): string {
  const p = viennaParts(now);
  const utc = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
  return `${p["day"]}.${p["month"]}.${p["year"]} ${p["hour"]}:${p["minute"]}:${p["second"]} (${utc} UTC)`;
}

/** `jde-fehlerbericht-<exercise id>-<YYYYMMDD-HHMM>.txt` (Vienna time). */
export function reportFileName(exerciseId: string, now: Date): string {
  const p = viennaParts(now);
  return `jde-fehlerbericht-${exerciseId}-${p["year"]}${p["month"]}${p["day"]}-${p["hour"]}${p["minute"]}.txt`;
}

export interface ReportDecision {
  reason: HandInReason;
  confirm: boolean;
  /** What goes to the hand-in; null = no test result. */
  summary: { passed: number; total: number } | null;
}

export interface ReportInput {
  now: Date;
  env: ReportEnv;
  exerciseId: string;
  hasTests: boolean;
  allowTests: boolean;
  testState: "idle" | "running";
  programRunning: boolean;
  last: { at: string; summary: { passed: number; total: number }; snapshot: SourceFileInput[] } | undefined;
  /** Editable files as they are now. */
  current: SourceFileInput[];
  decision: ReportDecision | undefined;
  events: LogEvent[];
}

const MODE: Record<ReportEnv["mode"], string> = { local: "Lokaler Modus", online: "Online-Modus", exam: "Prüfungsmodus" };

const REASON: Record<HandInReason, string> = {
  "no-tests": "keine Tests",
  "never-tested": "noch nie getestet",
  failed: "letzter Testlauf nicht bestanden",
  changed: "Code geändert",
  ok: "alle Tests bestanden, Code unverändert"
};

function size(n: number): string {
  return `${n} Zeichen`;
}

function fileLines(last: NonNullable<ReportInput["last"]>, current: SourceFileInput[]): { changed: boolean; lines: string[] } {
  const was = new Map(last.snapshot.map((f) => [f.path, f.content]));
  const now = new Map(current.map((f) => [f.path, f.content]));
  const paths = [...new Set([...was.keys(), ...now.keys()])];
  const lines: string[] = [];
  let changed = false;
  for (const path of paths) {
    const before = was.get(path);
    const after = now.get(path);
    if (before === undefined && after !== undefined) {
      changed = true;
      lines.push(`  ${path}  neu seit dem Testlauf: jetzt ${size(after.length)} #${shortHash(after)}`);
    } else if (after === undefined && before !== undefined) {
      changed = true;
      lines.push(`  ${path}  fehlt jetzt: im Testlauf ${size(before.length)} #${shortHash(before)}`);
    } else if (before !== undefined && after !== undefined) {
      if (before === after) {
        lines.push(`  ${path}  unverändert ${size(after.length)} #${shortHash(after)}`);
        continue;
      }
      changed = true;
      lines.push(`  ${path}  Testlauf ${size(before.length)} #${shortHash(before)} → jetzt ${size(after.length)} #${shortHash(after)}`);
      const d = firstLineDiff(before, after);
      if (d) {
        lines.push(`  erste Abweichung Zeile ${d.line}:`);
        lines.push(`    Testlauf: ${d.before === undefined ? "(Zeile fehlt)" : quoteLine(d.before)}`);
        lines.push(`    jetzt:    ${d.after === undefined ? "(Zeile fehlt)" : quoteLine(d.after)}`);
      }
    }
  }
  return { changed, lines };
}

/** The German, monospace-friendly report the student sends to the teacher. */
export function buildReport(i: ReportInput): string {
  const out: string[] = [];
  out.push(`J;DE Fehlerbericht – ${stamp(i.now)}`);
  out.push(`App ${i.env.appVersion} · ${i.env.os} · ${MODE[i.env.mode]}`);
  out.push(`Aufgabe ${i.exerciseId}${i.env.packageVersion ? ` · Paket ${i.env.packageVersion}` : ""}`);
  const tests = !i.hasTests ? "keine" : i.last ? String(i.last.summary.total) : "vorhanden (Anzahl unbekannt)";
  out.push(`Tests: ${tests} · Testen erlaubt: ${i.allowTests ? "ja" : "nein"}`);
  out.push(`Zustand: Testen ${i.testState} · Programm läuft ${i.programRunning ? "ja" : "nein"}`);
  if (!i.last) {
    out.push("Letzter Testlauf: keiner (in dieser App-Sitzung noch nicht getestet)");
  } else {
    out.push(`Letzter Testlauf: ${clockTime(i.last.at)} · ${i.last.summary.passed} / ${i.last.summary.total} bestanden`);
    const { changed, lines } = fileLines(i.last, i.current);
    out.push(`Code seit dem Testlauf geändert: ${changed ? "ja" : "nein"}`);
    out.push(...lines);
  }
  if (i.decision) {
    const d = i.decision;
    const result = d.summary ? `${d.summary.passed} von ${d.summary.total}` : "keins";
    out.push(`Entscheidung: ${d.confirm ? "nachfragen" : "nicht nachfragen"} (${REASON[d.reason]}), Ergebnis an Abgabe: ${result}`);
  } else {
    out.push("Entscheidung: noch keine");
  }
  out.push("Ereignisse:");
  if (i.events.length === 0) out.push("  (keine)");
  for (const e of i.events) out.push(`  ${clockTime(e.at)} ${e.text}`);
  return out.join("\n") + "\n";
}
