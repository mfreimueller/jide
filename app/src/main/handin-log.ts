import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * userData/handins.json: exercise id -> time and late flag of the last hand-in made on this laptop or found on
 * the server when restoring. This is what makes an exercise "Abgegeben" in the list.
 */
export interface HandInEntry {
  submittedAt: string;
  late: boolean;
  /**
   * Last sync point with the server on this laptop: hash of the normalised editable files right after the last
   * hand-in made here or the last restore (see handin-sync.ts). Missing: older log, state unknown.
   */
  base?: string;
}

export class HandInLog {
  private data: Record<string, HandInEntry> | undefined;

  /** `file` null: kept in memory only (exam mode: nothing may carry over from an earlier exam or student). */
  constructor(private readonly file: string | null) {}

  private load(): Record<string, HandInEntry> {
    if (!this.data) {
      if (!this.file) return (this.data = {});
      try {
        const d: unknown = JSON.parse(readFileSync(this.file, "utf8"));
        const out: Record<string, HandInEntry> = {};
        if (d && typeof d === "object" && !Array.isArray(d)) {
          for (const [id, v] of Object.entries(d)) {
            if (typeof v === "string") out[id] = { submittedAt: v, late: false }; // older file format
            else if (v && typeof v === "object" && typeof (v as HandInEntry).submittedAt === "string") {
              const base = (v as HandInEntry).base;
              out[id] = { submittedAt: (v as HandInEntry).submittedAt, late: (v as HandInEntry).late === true, ...(typeof base === "string" ? { base } : {}) };
            }
          }
        }
        this.data = out;
      } catch {
        this.data = {};
      }
    }
    return this.data;
  }

  get(id: string): HandInEntry | null {
    const v = this.load()[id];
    return v ?? null;
  }

  /** `base` undefined keeps the sync point stored so far. */
  set(id: string, submittedAt: string, late: boolean, base?: string): void {
    const data = this.load();
    const kept = base ?? data[id]?.base;
    data[id] = { submittedAt, late, ...(kept ? { base: kept } : {}) };
    if (!this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data), "utf8");
    renameSync(tmp, this.file);
  }
}
