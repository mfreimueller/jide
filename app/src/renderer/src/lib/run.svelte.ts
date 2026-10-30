import type { RunEndReason, RunEvent } from "../../../shared-types/api";
import { ConsoleTerm } from "./console-term";
import type { LiveCompiler } from "./problems.svelte";
import type { EditorSession } from "./session.svelte";

export type RunState = "idle" | "starting" | "running";

export const MSG_HAS_ERRORS = "Dein Programm enthält noch Fehler – schau unter Probleme.";
export const MSG_OUTPUT_LIMIT = "Dein Programm hat sehr viel ausgegeben und wurde gestoppt (Endlosschleife?).";

export function endMessage(reason: RunEndReason, code: number | null): string {
  if (reason === "stopped") return "■ Programm wurde gestoppt.";
  if (code === 0) return "■ Programm beendet.";
  return `■ Programm mit Fehler beendet (Code ${code ?? "?"}).`;
}

/** Ausführen / Stopp: starts the program through the main process and feeds the console. */
export class RunController {
  state = $state<RunState>("idle");
  readonly console: ConsoleTerm;

  private unsubscribe: () => void;
  private disposed = false;

  constructor(
    private readonly session: EditorSession,
    private readonly problems: LiveCompiler,
    private readonly exerciseId: string,
    private readonly mainFile: string,
    private readonly showTab: (tab: "Konsole" | "Probleme") => void
  ) {
    this.console = new ConsoleTerm(
      () => session.files.map((f) => ({ path: f.path, lineCount: session.lineCount(f.path) })),
      (path, line) => session.openAt(path, line)
    );
    this.console.onInputLine((line) => window.jide.sendInput(line));
    this.unsubscribe = window.jide.onRunEvent((e) => this.onEvent(e));
  }

  async start(): Promise<void> {
    if (this.state !== "idle") return;
    this.state = "starting";
    this.showTab("Konsole");
    try {
      await this.session.flush();
      const res = await window.jide.run(this.exerciseId, this.session.fileContents());
      if (!res.ok) {
        this.console.writeError(res.message);
        this.state = "idle";
        return;
      }
      if (this.disposed) {
        if (res.started) window.jide.stopRun(); // left the exercise while it was starting
        return;
      }
      this.problems.setFromRun(res.diagnostics);
      if (!res.started) {
        this.console.writeError(MSG_HAS_ERRORS);
        this.showTab("Probleme");
        this.state = "idle";
      }
      // started: the "started" event switches to "running"
    } catch {
      this.console.writeError("Das Programm konnte nicht gestartet werden.");
      this.state = "idle";
    }
  }

  stop(): void {
    if (this.state === "running") window.jide.stopRun();
  }

  clear(): void {
    this.console.clear();
  }

  private onEvent(e: RunEvent): void {
    if (e.kind === "started") {
      this.state = "running";
      this.console.setRunning(true);
      this.console.writeSystem(`▶ ${this.mainFile} wird ausgeführt …`);
      this.console.focus();
    } else if (e.kind === "output") {
      for (const c of e.chunks) this.console.writeOutput(c.stream, c.text);
    } else {
      this.console.setRunning(false);
      if (e.reason === "failed") this.console.writeError(e.message ?? "Das Programm konnte nicht gestartet werden.");
      else if (e.reason === "output-limit") this.console.writeError(MSG_OUTPUT_LIMIT);
      else this.console.writeSystem(endMessage(e.reason, e.code));
      this.state = "idle";
    }
  }

  /** Leaving the exercise: kill a running program. */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    window.jide.stopRun();
    this.console.dispose();
  }
}
