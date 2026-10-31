import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StudentInfo } from "../shared-types/api";

export interface StoredSession {
  /** The personal code (normalised, upper case). It is the token. */
  code: string;
  student: StudentInfo;
}

/** userData/session.json. A plain file is fine: the code is the only credential and lives on the student's own laptop. */
export class SessionStore {
  private current: StoredSession | undefined;
  private loaded = false;

  constructor(private readonly file: string) {}

  get(): StoredSession | undefined {
    if (!this.loaded) {
      this.loaded = true;
      try {
        const d = JSON.parse(readFileSync(this.file, "utf8")) as Partial<StoredSession>;
        if (typeof d.code === "string" && d.code && typeof d.student?.name === "string" && d.student.course) {
          this.current = { code: d.code, student: d.student };
        }
      } catch {
        this.current = undefined;
      }
    }
    return this.current;
  }

  set(s: StoredSession): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(s), "utf8");
    renameSync(tmp, this.file);
    this.current = s;
    this.loaded = true;
  }

  clear(): void {
    rmSync(this.file, { force: true });
    this.current = undefined;
    this.loaded = true;
  }
}
