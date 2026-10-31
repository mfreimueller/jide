import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * userData/handins.json: exercise id -> time of the last hand-in made on this laptop or found on
 * the server when restoring. This is what makes an exercise "Abgegeben" in the list.
 */
export class HandInLog {
  private data: Record<string, string> | undefined;

  constructor(private readonly file: string) {}

  private load(): Record<string, string> {
    if (!this.data) {
      try {
        const d: unknown = JSON.parse(readFileSync(this.file, "utf8"));
        this.data = d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, string>) : {};
      } catch {
        this.data = {};
      }
    }
    return this.data;
  }

  get(id: string): string | null {
    const v = this.load()[id];
    return typeof v === "string" ? v : null;
  }

  set(id: string, submittedAt: string): void {
    const data = this.load();
    data[id] = submittedAt;
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data), "utf8");
    renameSync(tmp, this.file);
  }
}
