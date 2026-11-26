import { rm } from "node:fs/promises";
import path from "node:path";
import { GRADE_SYMBOLS, KINDS, loadExercise, saveFile, type Exercise, type ExerciseKind, type HandInFile, type StudentExerciseGroup, type StudentExerciseSummary, type TestSummary } from "@jide/shared";
import { ApiClient, ApiError } from "./api-client";
import { GRADED_ERROR_CODE } from "@jide/shared";
import { isSafeExerciseId, needsDownload, PackageCache, restorableFiles } from "./package-cache";
import type { RemoteHandIn } from "./handin-sync";
import type { ExerciseSource, GradedViewResult, HandInOutcome, SourceEntry, SourceListing } from "./source";

const GENERIC = "Das hat leider nicht geklappt.";
export const GRADE_UNAVAILABLE_MESSAGE =
  "Die Beurteilung ist gerade nicht verfügbar. Verbinde dich mit dem Internet und versuche es noch einmal.";

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : GENERIC;
}

function toEntries(list: StudentExerciseSummary[]): SourceEntry[] {
  return list.map((e) => ({
    id: e.id,
    title: e.title,
    deadline: e.deadline ?? null,
    groupId: e.groupId ?? null,
    kind: (KINDS as readonly unknown[]).includes(e.kind) ? (e.kind as ExerciseKind) : "pflicht",
    grade: (GRADE_SYMBOLS as readonly unknown[]).includes(e.grade?.symbol) && typeof e.grade?.gradedAt === "string" ? e.grade : null
  }));
}

/** Exercises from the backend, cached in userData/cache (see PackageCache). */
export class OnlineSource implements ExerciseSource {
  readonly kind = "online" as const;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly api: ApiClient,
    private readonly cache: PackageCache
  ) {}

  /** Package swaps must not overlap (list reopened while an earlier refresh still runs). */
  private serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  list(): Promise<SourceListing> {
    return this.serial(() => this.refresh());
  }

  private async cached(offline: boolean, errors: string[] = []): Promise<SourceListing> {
    const list = (await this.cache.readList()) ?? [];
    return { exercises: toEntries(list), groups: await this.cache.readGroups(), errors, offline };
  }

  private async refresh(): Promise<SourceListing> {
    let remote: { exercises: StudentExerciseSummary[]; groups: StudentExerciseGroup[] };
    try {
      remote = await this.api.exercises();
    } catch (e) {
      if (e instanceof ApiError && e.kind === "unauthorized") return { exercises: [], groups: [], errors: [], offline: false };
      if (e instanceof ApiError && e.kind === "offline") return this.cached(true);
      return this.cached(false, [messageOf(e)]);
    }

    const errors: string[] = [];
    const usable: StudentExerciseSummary[] = [];
    let offline = false;
    for (const ex of remote.exercises.filter((x) => isSafeExerciseId(x.id))) {
      try {
        await this.sync(ex);
      } catch (e) {
        if (e instanceof ApiError && e.kind === "unauthorized") return { exercises: [], groups: [], errors: [], offline: false };
        if (e instanceof ApiError && e.kind === "offline") offline = true;
        else errors.push(`Aufgabe „${ex.title}“: ${e instanceof ApiError ? e.message : "Das Paket ist ungültig."}`);
      }
      // An exercise without any local package cannot be opened, so it is not offered.
      if (await this.cache.hasFolder(ex.id)) usable.push(ex);
    }
    if (offline && usable.length === 0) {
      // Nothing from this refresh is usable; fall back to what was cached before.
      return this.cached(true, errors);
    }
    await this.cache.writeList(usable, remote.groups);
    return { exercises: toEntries(usable), groups: remote.groups, errors, offline };
  }

  /** Downloads the package unless the cached one has the announced version. */
  private async sync(ex: StudentExerciseSummary): Promise<void> {
    const cachedVersion = await this.cache.version(ex.id);
    const folder = await this.cache.hasFolder(ex.id);
    if (!needsDownload(cachedVersion, ex.version, folder)) return;
    const r = await this.api.downloadPackage(ex.id, folder ? cachedVersion : undefined);
    if (r.notModified) return;
    await this.cache.install(ex.id, r.version, r.zip);
  }

  async find(id: unknown): Promise<Exercise | undefined> {
    if (!isSafeExerciseId(id)) return undefined;
    const list = (await this.cache.readList()) ?? [];
    if (!list.some((e) => e.id === id)) return undefined;
    if (!(await this.cache.hasFolder(id))) return undefined;
    try {
      return await loadExercise(this.cache.exerciseDir(id));
    } catch {
      return undefined;
    }
  }

  async deadlineOf(id: string): Promise<string | null> {
    return (await this.cache.readList())?.find((e) => e.id === id)?.deadline ?? null;
  }

  async prepareWorkspace(
    ex: Exercise,
    workspaceRoot: string,
    workspaceExists: boolean
  ): Promise<{ ok: true; submittedAt?: string; late?: boolean } | { ok: false; message: string }> {
    if (workspaceExists) return { ok: true };
    // New laptop (or first time): the last hand-in, if any, is the starting point.
    let latest;
    try {
      latest = await this.api.latestHandIn(ex.id);
    } catch (e) {
      return { ok: false, message: messageOf(e) };
    }
    const files = restorableFiles(false, ex.files, latest);
    if (!files || !latest) return { ok: true };
    try {
      for (const f of files) await saveFile(ex, workspaceRoot, f.path, f.content);
    } catch {
      // Do not leave a half-restored workspace behind: it would never be restored again.
      await rm(path.join(workspaceRoot, ex.id), { recursive: true, force: true });
      return { ok: false, message: "Deine letzte Abgabe konnte nicht wiederhergestellt werden." };
    }
    return { ok: true, submittedAt: latest.submittedAt, late: await this.lateOf(ex.id, latest.submittedAt) };
  }

  /** The server computes "late" the same way: hand-in after the current deadline. */
  private async lateOf(id: string, submittedAt: string): Promise<boolean> {
    const deadline = await this.deadlineOf(id);
    return deadline !== null && new Date(submittedAt).getTime() > new Date(deadline).getTime();
  }

  async fetchLatestHandIn(ex: Exercise): Promise<RemoteHandIn | null> {
    try {
      const latest = await this.api.latestHandIn(ex.id);
      const files = restorableFiles(false, ex.files, latest);
      if (!latest || !files) return null;
      return { submittedAt: latest.submittedAt, late: await this.lateOf(ex.id, latest.submittedAt), files };
    } catch {
      // Offline or any other trouble: the exercise opens with the local state, without an error.
      return null;
    }
  }

  async gradedView(id: string): Promise<GradedViewResult> {
    if (!isSafeExerciseId(id)) return null;
    const entry = (await this.cache.readList())?.find((e) => e.id === id);
    if (!entry?.grade) return null;
    try {
      const grade = await this.api.grade(id);
      if (!grade) return null;
      await this.cache.writeGrade(id, grade).catch(() => undefined);
      return { ok: true, grade };
    } catch (e) {
      if (e instanceof ApiError && e.kind === "offline") {
        // Only a cached grade that is still the one the list announces may be shown.
        const cached = await this.cache.readGrade(id);
        if (cached && cached.gradedAt === entry.grade.gradedAt) return { ok: true, grade: cached };
        return { ok: false, message: GRADE_UNAVAILABLE_MESSAGE };
      }
      return { ok: false, message: messageOf(e) };
    }
  }

  async handIn(ex: Exercise, files: HandInFile[], testSummary: TestSummary | null): Promise<HandInOutcome> {
    try {
      const r = await this.api.handIn(ex.id, { files, testSummary });
      return { ok: true, submittedAt: r.submittedAt, late: r.late };
    } catch (e) {
      return { ok: false, message: messageOf(e), ...(e instanceof ApiError && e.code === GRADED_ERROR_CODE ? { graded: true } : {}) };
    }
  }
}
