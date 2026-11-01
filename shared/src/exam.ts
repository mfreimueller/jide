import { z } from "zod";
import { ExamConfigError } from "./errors.js";

export interface ExamConfig {
  mode: "exam";
  title: string;
  handInPath: string;
  jdkPath: string | null;
  allowTests: boolean;
}

export const DEFAULT_HAND_IN_PATH = "P:\\";

const unknownKeys = (iss: { code: string; keys?: string[] }): string | undefined =>
  iss.code === "unrecognized_keys"
    ? `Unbekannter Schlüssel ${(iss.keys ?? []).map((k) => `"${k}"`).join(", ")}`
    : undefined;

const examSchema = z.strictObject(
  {
    mode: z.literal("exam", { error: 'mode fehlt oder ist nicht "exam"' }),
    title: z
      .string({ error: "title fehlt oder ist kein Text" })
      .refine((s) => s.trim().length > 0, { error: "title darf nicht leer sein" }),
    handInPath: z
      .string({ error: "handInPath muss Text sein" })
      .refine((s) => s.trim().length > 0, { error: "handInPath darf nicht leer sein" })
      .default(DEFAULT_HAND_IN_PATH),
    jdkPath: z.string({ error: "jdkPath muss Text oder null sein" }).nullable().default(null),
    allowTests: z.boolean({ error: "allowTests muss true oder false sein" }).default(true),
  },
  { error: (iss) => unknownKeys(iss) ?? "exam.json muss ein Objekt sein" },
);

/** Parses and validates the text of an exam.json (no file access). Throws ExamConfigError with a German message. */
export function parseExamConfig(raw: string): ExamConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    throw new ExamConfigError(`exam.json ist kein gültiges JSON (${detail}).`);
  }
  const parsed = examSchema.safeParse(data);
  if (!parsed.success) {
    // A misspelt key also leaves the real key missing; the typo is the more useful message.
    const issue = parsed.error.issues.find((i) => i.code === "unrecognized_keys") ?? parsed.error.issues[0]!;
    const where = issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
    throw new ExamConfigError(`exam.json ist ungültig: ${issue.message}${where}.`);
  }
  return parsed.data;
}
