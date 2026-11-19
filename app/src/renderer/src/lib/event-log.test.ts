import { describe, expect, it } from "vitest";
import { EventLog } from "./event-log";

describe("EventLog", () => {
  it("keeps events oldest first with their time", () => {
    let t = Date.UTC(2026, 10, 19, 12, 30, 58);
    const log = new EventLog(20, () => new Date(t));
    log.add("Testen gedrückt");
    t += 7000;
    log.add("Testen fertig");
    expect(log.list()).toEqual([
      { at: "2026-11-19T12:30:58.000Z", text: "Testen gedrückt" },
      { at: "2026-11-19T12:31:05.000Z", text: "Testen fertig" }
    ]);
  });

  it("drops the oldest events beyond its size", () => {
    const log = new EventLog(3);
    for (const n of [1, 2, 3, 4, 5]) log.add(`e${n}`);
    expect(log.list().map((e) => e.text)).toEqual(["e3", "e4", "e5"]);
  });

  it("defaults to 20 entries", () => {
    const log = new EventLog();
    for (let i = 0; i < 25; i++) log.add(`e${i}`);
    expect(log.list()).toHaveLength(20);
    expect(log.list()[0]!.text).toBe("e5");
  });

  it("hands out a copy and can be cleared", () => {
    const log = new EventLog();
    log.add("a");
    log.list().pop();
    expect(log.list()).toHaveLength(1);
    log.clear();
    expect(log.list()).toEqual([]);
  });
});
