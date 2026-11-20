import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cleanModes, type HideMode, type HideModes } from "../shared-types/hiding";

/** Which account the choices belong to: server URL + the personal code (hashed, never stored in clear). */
export function accountKey(apiUrl: string, code: string | undefined): string {
  if (code === undefined) return "local";
  return createHash("sha256").update(`${apiUrl}\n${code}`).digest("hex").slice(0, 32);
}

/**
 * userData/hidden.json: `{ "<account key>": { "<exercise id>": "hidden" | "shown" } }`.
 * Only on this laptop. Two students on one laptop (one after the other) do not share choices because
 * every account has its own entry. Written atomically like the session store.
 */
export class HiddenStore {
  private data: Record<string, HideModes> | undefined;

  constructor(
    private readonly file: string,
    /** Account key of the current session (see accountKey). */
    private readonly account: () => string
  ) {}

  private load(): Record<string, HideModes> {
    if (!this.data) {
      this.data = {};
      try {
        const raw = JSON.parse(readFileSync(this.file, "utf8")) as unknown;
        if (raw && typeof raw === "object") {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) this.data[k] = cleanModes(v);
        }
      } catch {
        /* missing or broken file: nothing hidden by hand */
      }
    }
    return this.data;
  }

  get(): HideModes {
    return { ...(this.load()[this.account()] ?? {}) };
  }

  /** `mode` null = back to the automatic rule. Returns the new choices. */
  set(id: unknown, mode: unknown): HideModes | undefined {
    if (typeof id !== "string" || !id || (mode !== "hidden" && mode !== "shown" && mode !== null)) return undefined;
    const all = this.load();
    const mine = { ...(all[this.account()] ?? {}) };
    if (mode === null) delete mine[id];
    else mine[id] = mode as HideMode;
    all[this.account()] = mine;
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(all), "utf8");
    renameSync(tmp, this.file);
    return { ...mine };
  }
}
