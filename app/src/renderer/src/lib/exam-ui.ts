/** Texts and small helpers of the exam screens (start screen, workspace tabs). */

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

/** The assignment without its leading `# Title` line (the panel shows `assignmentHeading` instead). */
export function stripLeadingHeading(markdown: string): string {
  return markdown.replace(/^\s*#[ \t]+[^\n]*(\r?\n|$)/, "").replace(/^\s*\n/, "");
}
