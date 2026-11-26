import { createHash } from "node:crypto";
import type { HandInFile } from "@jide/shared";
import type { HandInEntry } from "./handin-log";

/** A hand-in on the server, reduced to the files this exercise can still edit. */
export interface RemoteHandIn {
  submittedAt: string;
  late: boolean;
  files: HandInFile[];
}

/**
 * What to do with a hand-in found on the server when an exercise that already has a local workspace is opened.
 * - none: nothing (no hand-in, offline, or this device already knows exactly this hand-in)
 * - record: the local files equal the hand-in; only remember it
 * - replace: the local files have no changes since the last sync; take the hand-in silently
 * - ask: the local files have unsubmitted changes; the student decides
 */
export type NewerHandInDecision = "none" | "record" | "replace" | "ask";

/**
 * Same rule as "Code geändert" in the renderer (test-state.ts normalizeForCompare): line endings (CRLF/CR → LF),
 * spaces and tabs at line ends and blank lines at the end of the file do not matter.
 */
export function normaliseCode(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "");
}

/** Hash of the normalised editable files: the "last sync point" stored per exercise. */
export function hashFiles(files: HandInFile[]): string {
  const rows = files
    .map((f) => [f.path, normaliseCode(f.content)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

/** Every file of `part` exists in `whole` with the same (normalised) content. */
function containsAll(whole: HandInFile[], part: HandInFile[]): boolean {
  const byPath = new Map(whole.map((f) => [f.path, normaliseCode(f.content)]));
  return part.every((f) => byPath.get(f.path) === normaliseCode(f.content));
}

function sameSet(a: HandInFile[], b: HandInFile[]): boolean {
  return a.length === b.length && containsAll(a, b);
}

export function decideNewerHandIn(i: {
  /** null: no hand-in, or it could not be fetched. */
  latest: RemoteHandIn | null;
  /** HandInLog entry of this device, if any. */
  known: HandInEntry | null;
  /** Editable files in the local workspace. */
  local: HandInFile[];
  /** Editable files as the exercise ships them. */
  starter: HandInFile[];
}): NewerHandInDecision {
  const { latest, known, local, starter } = i;
  if (!latest) return "none";
  // Compared as instants: the hand-in response and the latest-hand-in query need not format the time identically.
  if (known && new Date(known.submittedAt).getTime() === new Date(latest.submittedAt).getTime()) return "none";
  if (containsAll(local, latest.files)) return "record";
  // No sync point stored (never synced, or a log from an older version): only the starter files count as "unchanged".
  const unchanged = known?.base ? hashFiles(local) === known.base : sameSet(local, starter);
  return unchanged ? "replace" : "ask";
}

/** Hand-ins waiting for the student's answer, per exercise (main process memory only). */
const pending = new Map<string, RemoteHandIn>();

export function setPendingHandIn(id: string, h: RemoteHandIn): void {
  pending.set(id, h);
}

export function takePendingHandIn(id: string): RemoteHandIn | undefined {
  const h = pending.get(id);
  pending.delete(id);
  return h;
}
