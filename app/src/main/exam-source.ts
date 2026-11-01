import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { saveFile, type Exercise, type HandInFile, type TestSummary } from "@jide/shared";
import {
  differs,
  localOffsetIso,
  parseTime,
  rankCandidates,
  sameFiles,
  sameName,
  writeAtomic,
  type FileMap,
  type RestoreCandidate
} from "./exam-store";
import { LocalSource, type HandInOutcome } from "./source";

export const AUTOSAVE_DIR = "_autosave";
const ABGABE_FILE = "abgabe.json";
const AUTOSAVE_FILE = "autosave.json";

/** A write to the hand-in drive that was tried: when, and whether it worked. */
export interface SaveReport {
  ok: boolean;
  /** ISO 8601 UTC. */
  at: string;
}

export interface ExamSourceOptions {
  handInPath: string;
  /** The name from the start screen; null before "Prüfung starten". */
  getName: () => string | null;
  /** Called after every hand-in and every autosave that was tried. */
  onReport?: (r: SaveReport) => void;
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    const d: unknown = JSON.parse(await readFile(file, "utf8"));
    return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function editablePaths(ex: Exercise): string[] {
  return ex.files.filter((f) => f.editable).map((f) => f.path);
}

/** Reads the editable files of `ex` below `dir`; throws if one cannot be read. */
async function readEditable(ex: Exercise, dir: string): Promise<FileMap> {
  const out: FileMap = {};
  for (const p of editablePaths(ex)) out[p] = await readFile(path.join(dir, p), "utf8");
  return out;
}

function starterFiles(ex: Exercise): FileMap {
  const out: FileMap = {};
  for (const p of editablePaths(ex)) out[p] = ex.originals[p] ?? "";
  return out;
}

/**
 * Exam mode (SPEC 2, 3.5): exercises from `exercises/` next to the exe; hand-in and autosave go to
 * `<handInPath>/<exercise id>/`. Everything on the hand-in drive is written via temp file + rename.
 */
export class ExamSource extends LocalSource {
  private readonly opened = new Map<string, Exercise>();
  /** Editable files of the last successful hand-in (this session or read from the drive). */
  private readonly handedIn = new Map<string, FileMap>();
  /** Editable files of the last successful autosave in this session. */
  private readonly autosaved = new Map<string, FileMap>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    exercisesDir: string,
    private readonly opts: ExamSourceOptions
  ) {
    super(exercisesDir);
  }

  private get handInPath(): string {
    return this.opts.handInPath;
  }

  private exerciseDir(ex: Exercise): string {
    return path.join(this.handInPath, ex.id);
  }

  private report(ok: boolean): string {
    const at = new Date().toISOString();
    this.opts.onReport?.({ ok, at });
    return at;
  }

  /** Drive jobs must not overlap (interval, run and tab switch can coincide). */
  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async workspaceFiles(ex: Exercise, workspaceRoot: string): Promise<FileMap> {
    return readEditable(ex, path.join(workspaceRoot, ex.id));
  }

  /** Newest save time of the editable files in the local workspace; null if there is none. */
  private async localTime(ex: Exercise, workspaceRoot: string): Promise<number | null> {
    let newest: number | null = null;
    for (const p of editablePaths(ex)) {
      try {
        const t = (await stat(path.join(workspaceRoot, ex.id, p))).mtimeMs;
        if (newest === null || t > newest) newest = t;
      } catch {
        // missing file: not part of the local state
      }
    }
    return newest;
  }

  /**
   * Opening an exercise: the newest of the local workspace, the autosave and the hand-in becomes
   * the workspace (SPEC 3.5). Autosave and hand-in count only for the same student name. A drive
   * that cannot be reached means: local workspace, or starter code.
   */
  async prepareWorkspace(
    ex: Exercise,
    workspaceRoot: string,
    _workspaceExists?: boolean
  ): Promise<{ ok: true; submittedAt?: string; late?: boolean } | { ok: false; message: string }> {
    this.opened.set(ex.id, ex);
    const name = this.opts.getName();
    const candidates: RestoreCandidate[] = [];
    const localAt = await this.localTime(ex, workspaceRoot);
    if (localAt !== null) candidates.push({ source: "local", at: localAt });

    let submittedAt: string | undefined;
    const dirs: Partial<Record<"autosave" | "handin", string>> = {};
    if (name && (await isDir(this.handInPath))) {
      const dir = this.exerciseDir(ex);
      const abgabe = await readJson(path.join(dir, ABGABE_FILE));
      if (abgabe && sameName(abgabe["name"], name) && Number.isFinite(parseTime(abgabe["submittedAt"]))) {
        submittedAt = new Date(parseTime(abgabe["submittedAt"])).toISOString();
        candidates.push({ source: "handin", at: parseTime(abgabe["submittedAt"]) });
        dirs.handin = dir;
        await this.rememberHandIn(ex, dir);
      }
      const auto = await readJson(path.join(dir, AUTOSAVE_DIR, AUTOSAVE_FILE));
      if (auto && sameName(auto["name"], name) && Number.isFinite(parseTime(auto["savedAt"]))) {
        candidates.push({ source: "autosave", at: parseTime(auto["savedAt"]) });
        dirs.autosave = path.join(dir, AUTOSAVE_DIR);
      }
    }

    for (const c of rankCandidates(candidates)) {
      if (c.source === "local") break; // the workspace is already the newest state
      let files: FileMap;
      try {
        files = await readEditable(ex, dirs[c.source]!);
      } catch {
        continue; // unreadable or incomplete: try the next older one
      }
      for (const [p, content] of Object.entries(files)) await saveFile(ex, workspaceRoot, p, content);
      break;
    }
    return submittedAt ? { ok: true, submittedAt, late: false } : { ok: true };
  }

  /** Remembers the files of the hand-in on the drive as "last handed in" (missing ones: the starter code). */
  private async rememberHandIn(ex: Exercise, dir: string): Promise<void> {
    const files = starterFiles(ex);
    for (const p of Object.keys(files)) {
      try {
        files[p] = await readFile(path.join(dir, p), "utf8");
      } catch {
        // keep the starter code for this file
      }
    }
    this.handedIn.set(ex.id, files);
  }

  private unreachableMessage(): string {
    return `Abgabe nicht gespeichert – ${this.handInPath} ist nicht erreichbar. Versuch es gleich nochmal.`;
  }

  async handIn(ex: Exercise, files: HandInFile[], testSummary: TestSummary | null): Promise<HandInOutcome> {
    return this.serial(async () => {
      const name = this.opts.getName();
      if (!name) return { ok: false, message: "Die Prüfung wurde noch nicht gestartet." };
      try {
        if (!(await isDir(this.handInPath))) throw new Error("hand-in drive missing");
        const dir = this.exerciseDir(ex);
        await mkdir(dir, { recursive: true });
        for (const f of files) await writeAtomic(path.join(dir, f.path), f.content);
        const now = new Date();
        const abgabe = {
          name,
          exercise: ex.id,
          title: ex.title,
          submittedAt: localOffsetIso(now),
          testSummary,
          files: files.map((f) => f.path)
        };
        await writeAtomic(path.join(dir, ABGABE_FILE), JSON.stringify(abgabe, null, 2) + "\n");
        this.handedIn.set(ex.id, Object.fromEntries(files.map((f) => [f.path, f.content])));
        this.opts.onReport?.({ ok: true, at: now.toISOString() });
        return { ok: true, submittedAt: now.toISOString(), late: false };
      } catch {
        this.report(false);
        return { ok: false, message: this.unreachableMessage() };
      }
    });
  }

  /**
   * Copies the saved editable files of the given opened exercises (default: all) to `_autosave/`.
   * Skips an exercise that is unchanged since its last successful autosave. The caller flushes the
   * editor first.
   */
  autosave(workspaceRoot: string, ids?: string[]): Promise<void> {
    return this.serial(async () => {
      const name = this.opts.getName();
      if (!name) return;
      for (const ex of this.opened.values()) {
        if (ids && !ids.includes(ex.id)) continue;
        let files: FileMap;
        try {
          files = await this.workspaceFiles(ex, workspaceRoot);
        } catch {
          continue; // workspace not readable: nothing to save
        }
        const last = this.autosaved.get(ex.id);
        if (last && sameFiles(last, files)) continue;
        try {
          if (!(await isDir(this.handInPath))) throw new Error("hand-in drive missing");
          const dir = path.join(this.exerciseDir(ex), AUTOSAVE_DIR);
          await mkdir(dir, { recursive: true });
          for (const [p, content] of Object.entries(files)) await writeAtomic(path.join(dir, p), content);
          const now = new Date();
          await writeAtomic(
            path.join(dir, AUTOSAVE_FILE),
            JSON.stringify({ name, exercise: ex.id, savedAt: localOffsetIso(now) }, null, 2) + "\n"
          );
          this.autosaved.set(ex.id, files);
          this.opts.onReport?.({ ok: true, at: now.toISOString() });
        } catch {
          this.report(false);
        }
      }
    });
  }

  /**
   * True if an opened exercise differs from its last hand-in, or, never handed in, from the
   * starter code (SPEC 3.5: the close confirmation).
   */
  async hasUnsubmittedChanges(workspaceRoot: string): Promise<boolean> {
    for (const ex of this.opened.values()) {
      let files: FileMap;
      try {
        files = await this.workspaceFiles(ex, workspaceRoot);
      } catch {
        continue;
      }
      if (differs(this.handedIn.get(ex.id) ?? starterFiles(ex), files)) return true;
    }
    return false;
  }
}
