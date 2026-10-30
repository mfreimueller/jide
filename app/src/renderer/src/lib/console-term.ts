import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { RESET, processInput } from "./console-input";
import { findStackLinks, type KnownFile } from "./stacktrace";

const SYSTEM_COLOR = "\x1b[38;2;139;141;152m"; // .console .sys
const ERROR_COLOR = "\x1b[38;2;255;99;105m";

/** The xterm console: program output, line-based input with local echo and clickable stack frames. */
export class ConsoleTerm {
  private readonly term: Terminal;
  private readonly fit = new FitAddon();
  private buffer = "";
  private inputEnabled = false;
  private atLineStart = true;
  private opened = false;
  private onLine: (line: string) => void = () => undefined;

  constructor(
    knownFiles: () => KnownFile[],
    openAt: (path: string, line: number) => void
  ) {
    this.term = new Terminal({
      convertEol: true,
      cursorStyle: "block",
      cursorBlink: false,
      fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.6,
      scrollback: 5000,
      theme: { background: "#1c2024", foreground: "#e8e8e8", cursor: "#e8e8e8" }
    });
    this.term.loadAddon(this.fit);
    this.term.write("\x1b[?25l"); // no cursor while nothing runs
    this.term.onData((data) => this.onData(data));
    this.term.registerLinkProvider({
      provideLinks: (y, callback) => {
        const text = this.term.buffer.active.getLine(y - 1)?.translateToString(true) ?? "";
        const links = findStackLinks(text, knownFiles());
        callback(
          links.length === 0
            ? undefined
            : links.map((l) => ({
                range: { start: { x: l.start + 1, y }, end: { x: l.start + l.length, y } },
                text: text.slice(l.start, l.start + l.length),
                activate: () => openAt(l.path, l.line)
              }))
        );
      }
    });
  }

  open(element: HTMLElement): void {
    if (this.opened) return;
    this.opened = true;
    this.term.open(element);
  }

  /** Adapts rows/columns to the container; does nothing while the container is hidden. */
  refit(): void {
    if (!this.opened) return;
    const el = this.term.element?.parentElement;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
    this.fit.fit();
  }

  /** Re-measures the characters (e.g. after the code font has been loaded). */
  remeasure(): void {
    const size = this.term.options.fontSize ?? 13;
    this.term.options.fontSize = size + 1;
    this.term.options.fontSize = size;
    this.refit();
  }

  focus(): void {
    this.term.focus();
  }

  onInputLine(handler: (line: string) => void): void {
    this.onLine = handler;
  }

  /** Typing only works while a program runs; the cursor is shown only then. */
  setRunning(running: boolean): void {
    this.inputEnabled = running;
    this.buffer = "";
    this.term.write(running ? "\x1b[?25h" : "\x1b[?25l");
  }

  writeSystem(text: string): void {
    this.line(SYSTEM_COLOR + text + RESET);
  }

  writeError(text: string): void {
    this.line(ERROR_COLOR + text + RESET);
  }

  /** Program output; stderr in red. */
  writeOutput(stream: "stdout" | "stderr", text: string): void {
    if (text === "") return;
    this.term.write(stream === "stderr" ? ERROR_COLOR + text + RESET : text);
    this.atLineStart = text.endsWith("\n");
  }

  clear(): void {
    this.term.reset();
    this.atLineStart = true;
    this.buffer = "";
    this.term.write(this.inputEnabled ? "\x1b[?25h" : "\x1b[?25l");
  }

  dispose(): void {
    this.term.dispose();
  }

  /** A whole line of our own (never glued to unfinished program output). */
  private line(coloured: string): void {
    this.term.write((this.atLineStart ? "" : "\r\n") + coloured + "\r\n");
    this.atLineStart = true;
  }

  private onData(data: string): void {
    if (!this.inputEnabled) return;
    const r = processInput(this.buffer, data);
    this.buffer = r.buffer;
    if (r.echo) {
      this.term.write(r.echo);
      this.atLineStart = r.echo.endsWith("\n");
    }
    for (const line of r.lines) this.onLine(line);
  }
}
