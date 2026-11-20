import type { Exercise, HandInFile, TestSummary } from "@jide/shared";
import { isScratchId, SCRATCH_PREFIX, type ImportedInfo, type ScratchStore } from "./scratch";
import type { ExerciseSource, GradedViewResult, HandInOutcome, SourceEntry, SourceListing } from "./source";

/** How a Scratch program appears in a list. */
export function scratchEntry(e: Exercise, imported?: ImportedInfo): SourceEntry {
  return {
    ...(imported ? { imported: true, testCount: imported.tests } : {}),
    difficulty: e.difficulty ?? null,
    id: e.id,
    title: e.title,
    deadline: null,
    groupId: null,
    scratch: true,
    classCount: e.files.filter((f) => f.path.endsWith(".java")).length
  };
}

/**
 * The main source plus Scratch. Ids starting with `scratch-` belong to Scratch only, everything else
 * to the main source, so nothing from Scratch ever reaches the backend (no hand-in, no download).
 */
export class CompositeSource implements ExerciseSource {
  readonly kind: ExerciseSource["kind"];
  handIn?: (ex: Exercise, files: HandInFile[], testSummary: TestSummary | null) => Promise<HandInOutcome>;

  constructor(
    readonly main: ExerciseSource,
    readonly scratch: ScratchStore
  ) {
    this.kind = main.kind;
    if (main.handIn) {
      this.handIn = async (ex, files, testSummary) =>
        isScratchId(ex.id)
          ? { ok: false, message: "Abgeben ist für Scratch-Programme nicht möglich." }
          : main.handIn!(ex, files, testSummary);
    }
  }

  async gradedView(id: string): Promise<GradedViewResult> {
    return this.isScratch(id) || !this.main.gradedView ? null : this.main.gradedView(id);
  }

  async list(): Promise<SourceListing> {
    const listing = await this.main.list();
    const mine = await this.scratch.list();
    return {
      ...listing,
      // The prefix is reserved for Scratch: a server exercise with such an id would be unreachable anyway.
      exercises: [
        ...listing.exercises.filter((e) => !e.id.startsWith(SCRATCH_PREFIX)),
        ...mine.exercises.map((e) => scratchEntry(e, mine.imported.get(e.id)))
      ],
      errors: [...listing.errors, ...mine.errors]
    };
  }

  private isScratch(id: unknown): boolean {
    return typeof id === "string" && id.startsWith(SCRATCH_PREFIX);
  }

  find(id: unknown): Promise<Exercise | undefined> {
    return this.isScratch(id) ? this.scratch.find(id) : this.main.find(id);
  }

  async deadlineOf(id: string): Promise<string | null> {
    return this.isScratch(id) ? null : this.main.deadlineOf(id);
  }

  async prepareWorkspace(ex: Exercise, workspaceRoot: string, workspaceExists: boolean) {
    // Scratch is local only: no hand-in to restore, no network.
    return this.isScratch(ex.id) ? { ok: true as const } : this.main.prepareWorkspace(ex, workspaceRoot, workspaceExists);
  }
}
