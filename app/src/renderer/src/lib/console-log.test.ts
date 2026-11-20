import { describe, expect, it } from "vitest";
import type { ConsoleOp } from "../../../shared-types/panel-messages";
import { appendConsoleLog, CONSOLE_LOG_LIMIT } from "./console-log";

describe("appendConsoleLog", () => {
  it("keeps ops in order and counts their text", () => {
    const log: ConsoleOp[] = [];
    let size = appendConsoleLog(log, { op: "system", text: "abc" }, 0);
    size = appendConsoleLog(log, { op: "output", stream: "stdout", text: "de" }, size);
    size = appendConsoleLog(log, { op: "running", running: true }, size);
    expect(log.map((o) => o.op)).toEqual(["system", "output", "running"]);
    expect(size).toBe(6);
  });

  it("a clear forgets the history before it", () => {
    const log: ConsoleOp[] = [];
    let size = appendConsoleLog(log, { op: "output", stream: "stdout", text: "alt" }, 0);
    size = appendConsoleLog(log, { op: "clear" }, size);
    expect(log).toEqual([]);
    expect(size).toBe(0);
    size = appendConsoleLog(log, { op: "system", text: "neu" }, size);
    expect(log).toHaveLength(1);
  });

  it("drops the oldest ops beyond the limit but keeps the newest", () => {
    const log: ConsoleOp[] = [];
    const big = "x".repeat(CONSOLE_LOG_LIMIT / 2 + 1);
    let size = 0;
    for (let i = 0; i < 3; i++) size = appendConsoleLog(log, { op: "output", stream: "stdout", text: big + i }, size);
    expect(log).toHaveLength(1);
    expect((log[0] as { text: string }).text.endsWith("2")).toBe(true);
    expect(size).toBeLessThanOrEqual(CONSOLE_LOG_LIMIT + 10);
  });
});
