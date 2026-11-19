/** "1 Klasse" / "2 Klassen". */
export function classCountLabel(n: number): string {
  return n === 1 ? "1 Klasse" : `${n} Klassen`;
}

/** Second line of a Scratch card. */
export function scratchLine(classCount: number): string {
  return `Eigenes Programm · ${classCountLabel(classCount)}`;
}

/** Only classes the student added can be deleted; `Main.java` (the main file) never. */
export function canDeleteClass(path: string, mainFile: string): boolean {
  return path !== mainFile && path !== "Main.java";
}
