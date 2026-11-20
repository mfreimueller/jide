/** "1 Klasse" / "2 Klassen". */
export function classCountLabel(n: number): string {
  return n === 1 ? "1 Klasse" : `${n} Klassen`;
}

/** Second line of a Scratch card. */
export function scratchLine(classCount: number): string {
  return `Eigenes Programm · ${classCountLabel(classCount)}`;
}

/** "Importiert · 3 Tests" (second line of an imported card). */
export function importedLine(testCount: number): string {
  return `Importiert · ${testCount === 0 ? "keine Tests" : testCount === 1 ? "1 Test" : `${testCount} Tests`}`;
}

/**
 * Only classes the student added can be deleted: never `Main.java`, the main file, or a class that came
 * with an imported exercise (`importedFiles`).
 */
export function canDeleteClass(path: string, mainFile: string, importedFiles: readonly string[] = []): boolean {
  return path !== mainFile && path !== "Main.java" && !importedFiles.includes(path);
}
