import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { HandInLog } from "./handin-log";

it("keeps time and late flag across instances and reads the older string format", () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "jide-log-")), "handins.json");
  writeFileSync(file, JSON.stringify({ alt: "2026-11-01T10:00:00Z" }));
  const log = new HandInLog(file);
  expect(log.get("alt")).toEqual({ submittedAt: "2026-11-01T10:00:00Z", late: false });
  log.set("neu", "2026-11-02T10:00:00Z", true);
  expect(new HandInLog(file).get("neu")).toEqual({ submittedAt: "2026-11-02T10:00:00Z", late: true });
  expect(new HandInLog(file).get("nix")).toBeNull();
});
