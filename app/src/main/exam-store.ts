import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Editable file contents by relative path. */
export type FileMap = Record<string, string>;

export type CandidateSource = "local" | "autosave" | "handin";

/** One place an exercise could be restored from; `at` = milliseconds since the epoch. */
export interface RestoreCandidate {
  source: CandidateSource;
  at: number;
}

const TIE_ORDER: Record<CandidateSource, number> = { local: 0, autosave: 1, handin: 2 };

/**
 * Newest first. On equal times the local workspace wins (nothing to copy), then the autosave,
 * then the hand-in. Candidates without a valid time are dropped.
 */
export function rankCandidates(candidates: RestoreCandidate[]): RestoreCandidate[] {
  return candidates
    .filter((c) => Number.isFinite(c.at))
    .sort((a, b) => b.at - a.at || TIE_ORDER[a.source] - TIE_ORDER[b.source]);
}

/** Milliseconds of an ISO 8601 text; NaN if it is not a date. */
export function parseTime(iso: unknown): number {
  return typeof iso === "string" ? new Date(iso).getTime() : Number.NaN;
}

/** Names match if equal after trimming, ignoring case. Anything but text never matches. */
export function sameName(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = a.trim().toLowerCase();
  return x.length > 0 && x === b.trim().toLowerCase();
}

/** ISO 8601 with the local offset and milliseconds, e.g. 2026-12-03T10:44:12.345+01:00 (the milliseconds keep an autosave right after a hand-in apart). `offsetMinutes` as Date#getTimezoneOffset. */
export function localOffsetIso(d: Date, offsetMinutes: number = d.getTimezoneOffset()): string {
  const local = new Date(d.getTime() - offsetMinutes * 60_000);
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${local.toISOString().slice(0, 23)}${sign}${two(Math.floor(abs / 60))}:${two(abs % 60)}`;
}

/** True if any file of `baseline` has other content in `current` (a file missing in `current` counts as changed). */
export function differs(baseline: FileMap, current: FileMap): boolean {
  return Object.keys(baseline).some((p) => current[p] !== baseline[p]);
}

export function sameFiles(a: FileMap, b: FileMap): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && !differs(a, b) && ka.every((k) => k in b);
}

/**
 * Folder name below `workspaces/` in exam mode: one per exam folder, exam title and student, so an
 * earlier exam or another student on the same Windows account never sees this work.
 */
export function examWorkspaceKey(examDir: string, title: string, name: string): string {
  const h = createHash("sha256");
  h.update(JSON.stringify([examDir, title, name.trim().toLowerCase()]));
  return h.digest("hex").slice(0, 16);
}

export const DEFAULT_AUTOSAVE_MS = 60_000;

/** Autosave interval; only an unpackaged app (dev, e2e) may override it with JIDE_AUTOSAVE_MS. */
export function autosaveInterval(env: string | undefined, packaged: boolean): number {
  if (packaged || env === undefined) return DEFAULT_AUTOSAVE_MS;
  const n = Number(env);
  return Number.isInteger(n) && n >= 50 ? n : DEFAULT_AUTOSAVE_MS;
}

/** Writes a file via a temp file in the same folder and a rename, so a failing write leaves no half file. */
export async function writeAtomic(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, file);
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw e;
  }
}
