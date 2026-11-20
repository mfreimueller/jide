import type { OpenedExercise } from "../../../shared-types/api";
import type { ConsoleOp, PanelInit, PanelState, WindowMessage } from "../../../shared-types/panel-messages";
import { appendConsoleLog } from "./console-log";
import type { LiveCompiler } from "./problems.svelte";
import type { RunController } from "./run.svelte";
import type { EditorSession } from "./session.svelte";
import type { TestController } from "./test.svelte";
import { isDetached, panels } from "./panels.svelte";
import { togglePanel } from "./layout.svelte";

export interface PanelHubDeps {
  exercise: OpenedExercise;
  session: EditorSession;
  problems: LiveCompiler;
  run: RunController;
  tests?: TestController;
  assignment: () => { markdown: string; deadline: string | null; submittedAt: string | null; late: boolean };
  canPickAssignment: boolean;
  pickAssignment: () => void;
}

/**
 * The owner side of the detached panels (M10), in the renderer of the main window: it keeps all state
 * (editor models, compile, run, tests), answers the requests of panel windows and tells them what
 * changed. A panel window never works on its own copy of anything but the text it is editing.
 */
export class PanelHub {
  private readonly stops: (() => void)[] = [];
  private readonly log: ConsoleOp[] = [];
  private logSize = 0;
  private lastSent = "";

  constructor(private readonly d: PanelHubDeps) {
    const api = window.jide.panels;
    this.stops.push(api.onFromWindow((m) => this.onMessage(m)));
    // Before anything else reacts to a changed set: no editor in this window while Code is detached.
    this.stops.push(
      api.onChange((list) => {
        d.session.remote = list.includes("code");
        this.lastSent = ""; // a new window starts from a full state
      })
    );
    d.session.onReveal = (path, line, column) => {
      api.toWindows({ kind: "reveal", path, line, column });
      api.focus("code");
    };
    d.run.console.onOp = (op) => {
      this.record(op, true);
      // like in the main window, the console gets the keyboard when a program starts (it waits for input)
      if (op.op === "running" && op.running && isDetached("console")) api.focus("console");
    };
    // Sends the state to the panel windows whenever something they show changes.
    this.stops.push(
      $effect.root(() => {
        $effect(() => {
          const state = this.snapshot();
          if (panels.detached.length === 0) return;
          const json = JSON.stringify(state);
          if (json === this.lastSent) return;
          this.lastSent = json;
          api.toWindows({ kind: "state", state });
        });
      })
    );
  }

  private record(op: ConsoleOp, forward: boolean): void {
    this.logSize = appendConsoleLog(this.log, op, this.logSize);
    if (forward && panels.detached.length > 0) window.jide.panels.toWindows({ kind: "console-op", op });
  }

  snapshot(): PanelState {
    const { session, problems, run, tests, exercise } = this.d;
    session.editVersion; // line counts follow the typing
    return {
      saveState: session.saveState,
      saveError: session.saveError,
      runState: run.state,
      files: session.files.map((f) => ({ path: f.path, editable: f.editable, lineCount: session.lineCount(f.path) })),
      openTabs: [...session.openTabs],
      active: session.active,
      diagnostics: $state.snapshot(problems.diagnostics),
      systemError: problems.systemError,
      ...(tests
        ? {
            tests: {
              state: tests.state,
              ...(tests.last ? { last: { results: tests.last.results, summary: tests.last.summary, at: tests.last.at } } : {}),
              stale: tests.stale,
              mainFile: tests.mainFile
            }
          }
        : {}),
      assignment: { ...this.d.assignment(), canPick: this.d.canPickAssignment && exercise.scratch === true }
    };
  }

  private init(): PanelInit {
    const { exercise, session } = this.d;
    const contents = new Map(session.fileContents().map((f) => [f.path, f.content]));
    return {
      exercise: {
        id: exercise.id,
        title: exercise.title,
        mainFile: exercise.mainFile,
        files: session.files.map((f) => ({ path: f.path, editable: f.editable, content: contents.get(f.path) ?? f.content })),
        // the exercise comes from a $state in App: a proxy cannot be sent
        images: $state.snapshot(exercise.images)
      },
      state: this.snapshot(),
      consoleLog: [...this.log]
    };
  }

  private onMessage(m: WindowMessage): void {
    const { session, run, tests } = this.d;
    const api = window.jide.panels;
    switch (m.kind) {
      case "hello":
        api.toWindows({ kind: "init", panel: m.panel, init: this.init() });
        break;
      case "edit":
        session.applyRemoteEdit(m.path, m.content);
        break;
      case "open-file":
        session.openFile(m.path);
        break;
      case "open-at":
        if (!isDetached("code")) api.focusMain();
        session.openAt(m.path, m.line, m.column ?? 1);
        break;
      case "run":
        void run.start();
        break;
      case "stop":
        run.stop();
        break;
      case "test":
        void tests?.start();
        break;
      case "clear-console":
        run.clear();
        break;
      case "console-op":
        // typed into a detached Konsole: its copy has it already, ours and the history need it
        run.console.applyOp(m.op);
        this.record(m.op, false);
        break;
      case "pick-assignment":
        this.d.pickAssignment();
        break;
      case "toggle-panel":
        togglePanel(m.panel);
        break;
    }
  }

  dispose(): void {
    for (const stop of this.stops.splice(0)) stop();
    this.d.session.onReveal = undefined;
    this.d.session.remote = false;
    this.d.run.console.onOp = undefined;
  }
}
