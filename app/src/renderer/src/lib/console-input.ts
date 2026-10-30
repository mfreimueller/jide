/** Green of the design's console input (.console .in). */
export const INPUT_COLOR = "\x1b[38;2;124;226;166m";
export const RESET = "\x1b[0m";

export interface InputResult {
  /** The line typed so far. */
  buffer: string;
  /** What to write to the terminal (local echo). */
  echo: string;
  /** Finished lines, each including its "\n", to send to the program. */
  lines: string[];
}

/**
 * Line-based input for the console: printable characters are echoed (green), Backspace removes
 * the last character, Enter finishes the line. Escape sequences (arrow keys …) and other control
 * characters are ignored.
 */
export function processInput(buffer: string, data: string): InputResult {
  let buf = buffer;
  let echo = "";
  const lines: string[] = [];
  if (data.startsWith("\x1b")) return { buffer, echo, lines }; // arrow keys, Home, Delete …
  for (const ch of data) {
    if (ch === "\r" || ch === "\n") {
      lines.push(buf + "\n");
      buf = "";
      echo += "\r\n";
    } else if (ch === "\x7f" || ch === "\b") {
      const chars = [...buf];
      if (chars.length > 0) {
        chars.pop();
        buf = chars.join("");
        echo += "\b \b";
      }
    } else if (ch >= " " && ch !== "\x7f") {
      buf += ch;
      echo += INPUT_COLOR + ch + RESET;
    }
  }
  return { buffer: buf, echo, lines };
}
