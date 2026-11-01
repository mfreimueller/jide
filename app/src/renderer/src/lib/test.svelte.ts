import type { LiveCompiler } from "./problems.svelte";
import type { RunController } from "./run.svelte";
import { MSG_HAS_ERRORS } from "./run.svelte";
import type { EditorSession } from "./session.svelte";
import { editableContents, getLastTest, setLastTest, type LastTest } from "./test-state";

export type TestState = "idle" | "running";

/** Testen: runs the tests of the exercise through the main process and keeps the last result. */
export class TestController {
  state = $state<TestState>("idle");
  /** Last finished run of this exercise; survives leaving and re-opening the exercise. */
  last = $state<LastTest | undefined>();

  private disposed = false;

  constructor(
    private readonly session: EditorSession,
    private readonly problems: LiveCompiler,
    private readonly run: RunController,
    private readonly exerciseId: string,
    readonly mainFile: string,
    private readonly showTab: (tab: "Konsole" | "Probleme" | "Tests") => void
  ) {
    this.last = getLastTest(exerciseId);
  }

  async start(): Promise<void> {
    if (this.state !== "idle" || this.run.state !== "idle") return;
    this.state = "running";
    try {
      await this.session.flush();
      const files = this.session.fileContents();
      const snapshot = editableContents(this.session.files, files);
      const res = await window.jide.test(this.exerciseId, files);
      if (!res.ok) {
        if (this.disposed) return;
        this.run.console.writeError(res.message);
        this.showTab("Konsole");
        return;
      }
      if (!res.started) {
        if (this.disposed) return;
        this.problems.setFromRun(res.diagnostics);
        this.run.console.writeError(MSG_HAS_ERRORS);
        this.showTab("Probleme");
        return;
      }
      const last: LastTest = { results: res.results, summary: res.summary, snapshot, at: new Date().toISOString() };
      setLastTest(this.exerciseId, last); // also when the student has left meanwhile
      if (this.disposed) return;
      this.last = last;
      this.showTab("Tests");
    } catch {
      if (this.disposed) return;
      this.run.console.writeError("Die Tests konnten nicht gestartet werden.");
      this.showTab("Konsole");
    } finally {
      if (!this.disposed) this.state = "idle";
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}
