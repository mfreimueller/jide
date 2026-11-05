import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ExerciseError } from "./errors.js";

export type MatchMode = "exact" | "contains" | "trimmed" | "lines";

export interface IoTestCase {
  type: "io";
  name: string;
  input: string;
  expected: string;
  match: MatchMode;
  timeoutMs: number;
}

export type CheckTestCase =
  | { type: "check"; name: string; call: string; expected: string; timeoutMs: number }
  | { type: "check"; name: string; code: string; timeoutMs: number };

export type TestCase = IoTestCase | CheckTestCase;

export const DEFAULT_TEST_TIMEOUT_MS = 2000;
export const MAX_TEST_TIMEOUT_MS = 30_000;

const unknownKeys = (iss: { code: string; keys?: string[] }): string | undefined =>
  iss.code === "unrecognized_keys"
    ? `Unbekannter Schlüssel ${(iss.keys ?? []).map((k) => `"${k}"`).join(", ")}`
    : undefined;

const nameSchema = z
  .string({ error: "name fehlt oder ist kein Text" })
  .refine((s) => s.trim().length > 0, { error: "name darf nicht leer sein" });

const expectedSchema = z
  .union([z.string(), z.number(), z.boolean()], { error: "expected fehlt oder ist kein Text, keine Zahl und kein true/false" })
  .transform(String);

const timeoutSchema = z
  .string({ error: 'timeout muss Text wie "2s" oder "500ms" sein' })
  .regex(/^\d+(ms|s)$/, { error: 'timeout muss die Form "2s" oder "500ms" haben' })
  .transform((s) => (s.endsWith("ms") ? Number(s.slice(0, -2)) : Number(s.slice(0, -1)) * 1000))
  .refine((ms) => ms > 0, { error: "timeout muss größer als 0 sein" })
  .refine((ms) => ms <= MAX_TEST_TIMEOUT_MS, { error: "timeout darf höchstens 30s sein" })
  .default(DEFAULT_TEST_TIMEOUT_MS);

const ioSchema = z.strictObject(
  {
    name: nameSchema,
    type: z.literal("io"),
    input: z.string({ error: "input muss Text sein" }).default(""),
    expected: expectedSchema,
    match: z
      .enum(["exact", "contains", "trimmed", "lines"], { error: "match muss exact, contains, trimmed oder lines sein" })
      .default("trimmed"),
    timeout: timeoutSchema,
  },
  { error: unknownKeys },
);

const checkSchema = z
  .strictObject(
    {
      name: nameSchema,
      type: z.literal("check"),
      call: z.string({ error: "call muss Text sein" }).min(1, { error: "call darf nicht leer sein" }).optional(),
      code: z.string({ error: "code muss Text sein" }).min(1, { error: "code darf nicht leer sein" }).optional(),
      expected: expectedSchema.optional(),
      timeout: timeoutSchema,
    },
    {
      error: (iss) =>
        iss.code === "unrecognized_keys" && iss.keys.includes("match")
          ? "match gibt es nur bei Tests vom Typ io"
          : unknownKeys(iss),
    },
  )
  .superRefine((t, ctx) => {
    if (t.call === undefined && t.code === undefined) {
      ctx.addIssue({ code: "custom", message: "Ein check-Test braucht call oder code" });
    } else if (t.call !== undefined && t.code !== undefined) {
      ctx.addIssue({ code: "custom", message: "Ein check-Test darf nicht call und code gleichzeitig haben" });
    } else if (t.call !== undefined && t.expected === undefined) {
      ctx.addIssue({ code: "custom", message: "expected fehlt (call braucht einen erwarteten Wert)", path: ["expected"] });
    } else if (t.code !== undefined && t.expected !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "expected ist bei code nicht erlaubt (der Code gibt true oder false zurück)",
        path: ["expected"],
      });
    }
  });

const testsSchema = z.strictObject(
  {
    tests: z
      .array(z.discriminatedUnion("type", [ioSchema, checkSchema], { error: "type muss io oder check sein" }), {
        error: "tests fehlt oder ist keine Liste",
      })
      .min(1, { error: "tests darf nicht leer sein" }),
  },
  { error: (iss) => unknownKeys(iss) ?? "tests fehlt oder ist keine Liste" },
);

/** Parses and validates the text of a tests.yaml (no file access). Throws ExerciseError with a German message. */
export function parseTestsConfig(raw: string, name = "?"): TestCase[] {
  const fail = (problem: string): never => {
    throw new ExerciseError(`Aufgabe "${name}": ${problem}`);
  };
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (e) {
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return fail(`tests.yaml ist kein gültiges YAML (${detail}).`);
  }

  const parsed = testsSchema.safeParse(data);
  if (!parsed.success) {
    // A misspelt key (exepcted) also leaves the real key missing; the typo is the more useful message.
    const issue = parsed.error.issues.find((i) => i.code === "unrecognized_keys") ?? parsed.error.issues[0]!;
    const where = issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
    return fail(`tests.yaml ist ungültig: ${issue.message}${where}.`);
  }

  const seen = new Set<string>();
  const result: TestCase[] = [];
  for (const t of parsed.data.tests) {
    if (seen.has(t.name)) fail(`tests.yaml ist ungültig: Testname "${t.name}" kommt doppelt vor.`);
    seen.add(t.name);
    if (t.type === "io") {
      result.push({ type: "io", name: t.name, input: t.input, expected: t.expected, match: t.match, timeoutMs: t.timeout });
    } else if (t.call !== undefined) {
      result.push({ type: "check", name: t.name, call: t.call, expected: t.expected!, timeoutMs: t.timeout });
    } else {
      result.push({ type: "check", name: t.name, code: t.code!, timeoutMs: t.timeout });
    }
  }
  return result;
}

function normaliseNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

function normaliseLoose(s: string): string {
  return normaliseNewlines(s)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

/** A comma or dot between two digits counts as the same (printf uses the locale's decimal separator). Lookarounds keep `1,2,3` consistent. */
function normaliseDecimal(s: string): string {
  return s.replace(/(?<=\d)[,.](?=\d)/g, ".");
}

function normaliseNumeric(s: string): string {
  return normaliseDecimal(normaliseLoose(s));
}

/** True if every non-empty expected line equals a whole actual line, in order; other actual lines are ignored. */
function matchLines(actual: string, expected: string): boolean {
  const actualLines = normaliseNumeric(actual)
    .split("\n")
    .filter((l) => l !== "");
  const expectedLines = normaliseNumeric(expected)
    .split("\n")
    .filter((l) => l !== "");
  let next = 0;
  for (const want of expectedLines) {
    while (next < actualLines.length && actualLines[next] !== want) next++;
    if (next === actualLines.length) return false;
    next++;
  }
  return true;
}

/**
 * Compares program output with the expected text. All modes ignore the line-ending style.
 * trimmed, contains and lines also treat a comma/dot between two digits as the same; exact does not.
 */
export function matchOutput(actual: string, expected: string, mode: MatchMode): boolean {
  switch (mode) {
    case "exact":
      return normaliseNewlines(actual) === normaliseNewlines(expected);
    case "trimmed":
      return normaliseNumeric(actual) === normaliseNumeric(expected);
    case "contains":
      return normaliseNumeric(actual).includes(normaliseNumeric(expected));
    case "lines":
      return matchLines(actual, expected);
  }
}
