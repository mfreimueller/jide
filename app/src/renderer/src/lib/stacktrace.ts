export interface KnownFile {
  path: string;
  /** Number of lines of the student's code (the hidden harness is not part of it). */
  lineCount: number;
}

export interface StackLink {
  /** 0-based index of the first character of "File.java:7" in the line, and its length. */
  start: number;
  length: number;
  path: string;
  line: number;
}

const FRAME = /^\s*at\s/;
const LOCATION = /\(([^():\s]+\.java):(\d+)\)/g;

function baseName(p: string): string {
  return p.slice(Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")) + 1);
}

/**
 * Finds "at Summe.main(Summe.java:7)" style locations in one console line. Only files of the
 * exercise and lines within the student's code become links (harness lines do not).
 */
export function findStackLinks(text: string, files: KnownFile[]): StackLink[] {
  if (!FRAME.test(text)) return [];
  const links: StackLink[] = [];
  for (const m of text.matchAll(LOCATION)) {
    const name = m[1]!;
    const line = Number(m[2]);
    const file = files.find((f) => baseName(f.path) === name);
    if (!file || line < 1 || line > file.lineCount) continue;
    links.push({ start: m.index + 1, length: name.length + 1 + m[2]!.length, path: file.path, line });
  }
  return links;
}
