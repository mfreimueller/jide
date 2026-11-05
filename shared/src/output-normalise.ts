// Text normalisation shared by matchOutput (tests.ts) and diffOutput (output-diff.ts). Not part of the package API.

export function normaliseNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

export function normaliseLoose(s: string): string {
  return normaliseNewlines(s)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

/** A comma or dot between two digits counts as the same (printf uses the locale's decimal separator). Lookarounds keep `1,2,3` consistent. */
export function normaliseDecimal(s: string): string {
  return s.replace(/(?<=\d)[,.](?=\d)/g, ".");
}

export function normaliseNumeric(s: string): string {
  return normaliseDecimal(normaliseLoose(s));
}
