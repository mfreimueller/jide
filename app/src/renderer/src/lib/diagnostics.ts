import type { Diagnostic } from "../../../shared-types/api";

// Same numeric values as monaco.MarkerSeverity (kept here so this module has no Monaco dependency).
export const SEVERITY_WARNING = 4;
export const SEVERITY_ERROR = 8;

export interface MarkerData {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/** A diagnostic that can be placed in a file; general errors (no file/line) have no marker. */
export function toMarker(d: Diagnostic): MarkerData | undefined {
  if (d.file === null || d.line === null) return undefined;
  const startColumn = d.column ?? 1;
  const endLineNumber = d.endLine ?? d.line;
  const endColumn = d.endColumn ?? startColumn + 1;
  return {
    severity: d.severity === "error" ? SEVERITY_ERROR : SEVERITY_WARNING,
    message: d.message,
    startLineNumber: d.line,
    startColumn,
    endLineNumber,
    endColumn
  };
}

export function markersByFile(diagnostics: Diagnostic[]): Map<string, MarkerData[]> {
  const out = new Map<string, MarkerData[]>();
  for (const d of diagnostics) {
    const m = toMarker(d);
    if (!m || d.file === null) continue;
    const list = out.get(d.file);
    if (list) list.push(m);
    else out.set(d.file, [m]);
  }
  return out;
}

export function errorCount(diagnostics: Diagnostic[]): number {
  return diagnostics.filter((d) => d.severity === "error").length;
}

/** Errors per file (warnings do not count). Errors without a file are not part of any file. */
export function errorCountByFile(diagnostics: Diagnostic[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of diagnostics) {
    if (d.severity !== "error" || d.file === null) continue;
    out.set(d.file, (out.get(d.file) ?? 0) + 1);
  }
  return out;
}

/** "Summe.java:7", "Summe.java" (no line) or "" (general error). */
export function locationLabel(d: Diagnostic): string {
  if (d.file === null) return "";
  return d.line === null ? d.file : `${d.file}:${d.line}`;
}
