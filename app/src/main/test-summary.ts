import type { TestSummary } from "@jide/shared";

/** Only a well-formed `{ passed, total }` goes to the server; anything else counts as "not tested". */
export function parseTestSummary(v: unknown): TestSummary | null {
  if (typeof v !== "object" || v === null) return null;
  const { passed, total } = v as Record<string, unknown>;
  if (!Number.isInteger(passed) || !Number.isInteger(total)) return null;
  const p = passed as number;
  const t = total as number;
  return p >= 0 && t >= 1 && p <= t ? { passed: p, total: t } : null;
}
