import type { Diagnostic } from "../../../shared-types/api";
import { errorCountByFile, markersByFile } from "./diagnostics";
import type { EditorSession } from "./session.svelte";

export const COMPILE_DELAY_MS = 500;
export const MARKER_OWNER = "javac";

/**
 * Auto-compile: compiles all files of the exercise 500 ms after the last edit, shows the result
 * as Monaco markers and keeps the list for the "Probleme" tab. Only the latest request counts.
 */
export class LiveCompiler {
  diagnostics = $state<Diagnostic[]>([]);
  /** Set when the compile helper / Java is not available (German message). */
  systemError = $state("");

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(
    private readonly session: EditorSession,
    private readonly exerciseId: string
  ) {
    session.onContentChange = () => this.schedule();
  }

  get errorsByFile(): Map<string, number> {
    return errorCountByFile(this.diagnostics);
  }

  get errorCount(): number {
    return this.diagnostics.filter((d) => d.severity === "error").length;
  }

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.compileNow(), COMPILE_DELAY_MS);
  }

  async compileNow(): Promise<void> {
    clearTimeout(this.timer);
    const mine = ++this.seq;
    let result;
    try {
      result = await window.jide.compile(this.exerciseId, this.session.fileContents());
    } catch {
      result = { ok: false as const, message: "Der Java-Helfer hat nicht geantwortet." };
    }
    if (mine !== this.seq || this.disposed) return; // a newer request exists: this answer is stale
    if (result.ok) this.set(result.diagnostics);
    else this.systemError = result.message;
  }

  /** Takes over the diagnostics of a run (the same compile) and drops older answers still in flight. */
  setFromRun(diagnostics: Diagnostic[]): void {
    this.seq++;
    this.set(diagnostics);
  }

  private set(diagnostics: Diagnostic[]): void {
    this.systemError = "";
    this.diagnostics = diagnostics;
    this.session.setMarkers(MARKER_OWNER, markersByFile(diagnostics));
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    this.session.onContentChange = undefined;
  }
}
