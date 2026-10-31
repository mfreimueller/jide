// German date/time formatting for the student UI. Everything is shown in Vienna time.

const ZONE = "Europe/Vienna";

const parts = new Intl.DateTimeFormat("de-AT", {
  timeZone: ZONE,
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function pick(iso: string): { weekday: string; day: string; month: string; hour: string; minute: string } | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const r: Record<string, string> = {};
  for (const p of parts.formatToParts(d)) r[p.type] = p.value;
  return {
    weekday: (r["weekday"] ?? "").replace(/\.$/, ""),
    day: r["day"] ?? "",
    month: r["month"] ?? "",
    hour: r["hour"] ?? "",
    minute: r["minute"] ?? ""
  };
}

/** "Fr, 27.11." */
export function formatDate(iso: string): string {
  const p = pick(iso);
  return p ? `${p.weekday}, ${p.day}.${p.month}.` : "";
}

/** "10:44" */
export function formatTime(iso: string): string {
  const p = pick(iso);
  return p ? `${p.hour}:${p.minute}` : "";
}

/** "Do, 19.11. um 10:44" */
export function formatDateTime(iso: string): string {
  const p = pick(iso);
  return p ? `${p.weekday}, ${p.day}.${p.month}. um ${p.hour}:${p.minute}` : "";
}

/** True once the deadline instant has passed. */
export function isPast(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < now.getTime();
}
