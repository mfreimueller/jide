import type { ConsoleOp } from "../../../shared-types/panel-messages";

/** The console history a new Konsole window replays is kept up to this many characters. */
export const CONSOLE_LOG_LIMIT = 1_000_000;

function weight(op: ConsoleOp): number {
  return "text" in op ? op.text.length : 1;
}

/**
 * Appends an op to the console history and returns the new size. A clear forgets everything before
 * it; beyond the limit the oldest ops are dropped (the terminal keeps only 5000 lines anyway).
 */
export function appendConsoleLog(log: ConsoleOp[], op: ConsoleOp, size: number): number {
  if (op.op === "clear") {
    log.length = 0;
    return 0;
  }
  log.push(op);
  size += weight(op);
  while (size > CONSOLE_LOG_LIMIT && log.length > 1) size -= weight(log.shift()!);
  return size;
}
