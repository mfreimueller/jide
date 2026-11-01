import type { SaveStatus } from "../../../shared-types/api";
import { formatTime } from "../../../shared-types/datetime";

/** Texts and small helpers of the exam screens (start screen, workspace tabs, save status). */

/** Footer of the start screen (Figma 07), e.g. "2 Aufgaben · Testen ist erlaubt". */
export function startFooter(count: number, allowTests: boolean): string {
  const n = `${count} ${count === 1 ? "Aufgabe" : "Aufgaben"}`;
  return `${n} · ${allowTests ? "Testen ist erlaubt" : "Testen ist nicht erlaubt"}`;
}

/** Label of the tab button of the exercise at `index` (0-based): "Aufgabe 1". */
export function tabLabel(index: number): string {
  return `Aufgabe ${index + 1}`;
}

/** Heading of the assignment panel: "Aufgabe 1: Summe zweier Zahlen". */
export function assignmentHeading(index: number, title: string): string {
  return `${tabLabel(index)}: ${title}`;
}

/**
 * The assignment without its leading `# Title` line, but only if that line is the exercise title
 * (the panel shows `assignmentHeading` instead). Any other first heading is the teacher's and stays.
 */
export function stripLeadingHeading(markdown: string, title: string): string {
  const m = /^\s*#[ \t]+([^\r\n]*)(\r?\n|$)/.exec(markdown);
  if (!m || m[1]!.trim() !== title.trim()) return markdown;
  return markdown.slice(m[0].length).replace(/^\s*\n/, "");
}

/** Right side of the dark bar (Figma 08/11); undefined before the first save. */
export function saveStatusView(
  status: SaveStatus | undefined,
  handInPath: string
): { tone: "ok" | "warn"; text: string } | undefined {
  if (!status) return undefined;
  return status.ok
    ? { tone: "ok", text: `● zuletzt gesichert auf ${handInPath} um ${formatTime(status.at)}` }
    : { tone: "warn", text: `● ${handInPath} nicht erreichbar – deine Arbeit ist nur auf diesem PC gesichert` };
}

/** Toast after a successful exam hand-in. */
export function handInToast(handInPath: string, iso: string): string {
  return `Abgabe gespeichert auf ${handInPath} – ${formatTime(iso)}`;
}
