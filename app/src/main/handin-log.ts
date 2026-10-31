import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * userData/handins.json: exercise id -> time and late flag of the last hand-in made on this laptop or found on
 * the server when restoring. This is what makes an exercise "Abgegeben" in the list.
 */
export interface HandInEntry {
  submittedAt: string;
  late: boolean;
}

export class HandInLog {
  private data: Record<string, HandInEntry> | undefined;

  constructor(private readonly file: string) {}

  private load(): Record<string, HandInEntry> {
    if (!this.data) {
      try {
        const d: unknown = JSON.parse(readFileSync(this.file, "utf8"));
        const out: Record<string, HandInEntry> = {};
        if (d && typeof d === "object" && !Array.isArray(d)) {
          for (const [id, v] of Object.entries(d)) {
            if (typeof v === "string") out[id] = { submittedAt: v, late: false }; // older file format
            else if (v && typeof v === "object" && typeof (v as HandInEntry).submittedAt === "string") {
              out[id] = { submittedAt: (v as HandInEntry).submittedAt, late: (v as HandInEntry).late === true };
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

  set(id: string, submittedAt: string, late: boolean): void {
    const data = this.load();
    data[id] = { submittedAt, late };
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data), "utf8");
    renameSync(tmp, this.file);
  }
}
