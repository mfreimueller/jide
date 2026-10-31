import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { ExerciseError, parseExerciseConfig, type HandInFile, type TestSummary } from '@jide/shared';
import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';

export const MAX_HANDIN_FILES = 50;
export const MAX_HANDIN_BYTES = 1024 * 1024;

/** A hand-in is late if the course has a deadline for the exercise and the hand-in came strictly after it. */
export function isLate(submittedAt: Date, deadline: Date | null): boolean {
  return deadline !== null && submittedAt.getTime() > deadline.getTime();
}

// ---- validation ----

/** Paths of the editable files in the stored (normalised) exercise package. */
export function editablePaths(zip: Uint8Array, slug: string): Set<string> {
  const name = `${slug}/exercise.yaml`;
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(zip, { filter: (f) => f.name === name });
  } catch {
    throw new AppError(500, 'INTERNAL', 'Das Aufgabenpaket ist beschädigt.');
  }
  const yaml = raw[name];
  if (!yaml) throw new AppError(500, 'INTERNAL', 'Das Aufgabenpaket ist beschädigt.');
  try {
    return new Set(
      parseExerciseConfig(strFromU8(yaml), slug)
        .files.filter((f) => f.editable)
        .map((f) => f.path)
    );
  } catch (e) {
    if (e instanceof ExerciseError) throw new AppError(500, 'INTERNAL', 'Das Aufgabenpaket ist beschädigt.');
    throw e;
  }
}

/** Checks the hand-in files against the editable paths and the size limits. Throws German AppErrors. */
export function validateHandInFiles(files: HandInFile[], editable: Set<string>): void {
  if (files.length === 0) throw new AppError(400, 'VALIDATION', 'Bitte mindestens eine Datei abgeben.');
  if (files.length > MAX_HANDIN_FILES) {
    throw new AppError(400, 'TOO_MANY_FILES', `Zu viele Dateien (höchstens ${MAX_HANDIN_FILES}).`);
  }
  const seen = new Set<string>();
  let bytes = 0;
  for (const f of files) {
    if (!editable.has(f.path)) {
      throw new AppError(400, 'INVALID_PATH', `Die Datei „${f.path.slice(0, 100)}“ gehört nicht zur Aufgabe oder darf nicht abgegeben werden.`);
    }
    if (seen.has(f.path)) throw new AppError(400, 'VALIDATION', `Die Datei „${f.path}“ ist doppelt enthalten.`);
    seen.add(f.path);
    bytes += Buffer.byteLength(f.content, 'utf8');
  }
  if (bytes > MAX_HANDIN_BYTES) {
    throw new AppError(413, 'TOO_LARGE', `Die Abgabe ist zu groß (höchstens ${MAX_HANDIN_BYTES / 1024 / 1024} MB Quelltext).`);
  }
}

// ---- storage ----

interface ExerciseRef {
  rowId: number;
  version: string;
}

export async function createHandIn(
  db: SQLInstance,
  studentId: number,
  exercise: ExerciseRef,
  files: HandInFile[],
  testSummary: TestSummary | null
): Promise<Date> {
  const submittedAt = new Date(); // server time only
  await db.begin(async (tx) => {
    const res = await tx<{ lastInsertRowid: number }>`
      INSERT INTO handins (student_id, exercise_id, submitted_at, exercise_version, tests_passed, tests_total)
      VALUES (${studentId}, ${exercise.rowId}, ${submittedAt}, ${exercise.version},
              ${testSummary?.passed ?? null}, ${testSummary?.total ?? null})
    `;
    for (const f of files) {
      await tx`INSERT INTO handin_files (handin_id, path, content) VALUES (${res.lastInsertRowid}, ${f.path}, ${f.content})`;
    }
  });
  return submittedAt;
}

/** Row id and version of an exercise that is unlocked for the course, or null. */
export async function unlockedExerciseRef(
  db: SQLInstance,
  courseId: number,
  slug: string
): Promise<(ExerciseRef & { zip: Buffer; deadline: Date | null }) | null> {
  const rows = await db<{ rowId: number; version: string; zip: Buffer; deadline: Date | null }[]>`
    SELECT e.id AS rowId, e.version, e.package AS zip, ce.deadline
    FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.unlocked = 1 AND e.slug = ${slug}
  `;
  return rows[0] ?? null;
}

async function filesOf(db: SQLInstance, handinId: number): Promise<HandInFile[]> {
  return db<HandInFile[]>`SELECT path, content FROM handin_files WHERE handin_id = ${handinId} ORDER BY path`;
}

export async function latestForStudent(
  db: SQLInstance,
  studentId: number,
  exerciseRowId: number
): Promise<{ submittedAt: string; files: HandInFile[] } | null> {
  const rows = await db<{ id: number; submittedAt: Date }[]>`
    SELECT id, submitted_at AS submittedAt FROM handins
    WHERE student_id = ${studentId} AND exercise_id = ${exerciseRowId} ORDER BY id DESC LIMIT 1
  `;
  const h = rows[0];
  if (!h) return null;
  return { submittedAt: h.submittedAt.toISOString(), files: await filesOf(db, h.id) };
}

// ---- teacher views ----

export interface MatrixCell {
  handinId: number;
  submittedAt: string;
  late: boolean;
  testSummary: TestSummary | null;
  count: number;
}

export interface Matrix {
  students: { id: number; name: string }[];
  exercises: { id: string; title: string; deadline: string | null }[];
  /** rows[i] belongs to students[i]; cells[j] to exercises[j]; null = no hand-in. */
  rows: { studentId: number; cells: (MatrixCell | null)[] }[];
}

const summaryOf = (passed: number | null, total: number | null): TestSummary | null =>
  passed === null || total === null ? null : { passed: Number(passed), total: Number(total) };

export async function handInMatrix(db: SQLInstance, courseId: number, onlyMissing: boolean): Promise<Matrix> {
  const exercises = await db<{ rowId: number; id: string; title: string; deadline: Date | null }[]>`
    SELECT e.id AS rowId, e.slug AS id, e.title, ce.deadline
    FROM course_exercises ce JOIN exercises e ON e.id = ce.exercise_id
    WHERE ce.course_id = ${courseId} AND ce.unlocked = 1
    ORDER BY e.title, e.slug
  `;
  const students = await db<{ id: number; name: string }[]>`
    SELECT id, name FROM students WHERE course_id = ${courseId} ORDER BY name, id
  `;
  const last = await db<
    { id: number; studentId: number; exerciseId: number; submittedAt: Date; passed: number | null; total: number | null; cnt: number | string }[]
  >`
    SELECT h.id, h.student_id AS studentId, h.exercise_id AS exerciseId, h.submitted_at AS submittedAt,
           h.tests_passed AS passed, h.tests_total AS total,
           (SELECT COUNT(*) FROM handins x WHERE x.student_id = h.student_id AND x.exercise_id = h.exercise_id) AS cnt
    FROM handins h
    JOIN students s ON s.id = h.student_id AND s.course_id = ${courseId}
    WHERE h.id = (SELECT MAX(y.id) FROM handins y WHERE y.student_id = h.student_id AND y.exercise_id = h.exercise_id)
  `;
  const byKey = new Map(last.map((h) => [`${h.studentId}:${h.exerciseId}`, h]));
  let rows = students.map((s) => ({
    studentId: s.id,
    cells: exercises.map((e): MatrixCell | null => {
      const h = byKey.get(`${s.id}:${e.rowId}`);
      if (!h) return null;
      return {
        handinId: h.id,
        submittedAt: h.submittedAt.toISOString(),
        late: isLate(h.submittedAt, e.deadline),
        testSummary: summaryOf(h.passed, h.total),
        count: Number(h.cnt),
      };
    }),
  }));
  if (onlyMissing) rows = rows.filter((r) => r.cells.some((c) => c === null));
  const shown = new Set(rows.map((r) => r.studentId));
  return {
    students: students.filter((s) => shown.has(s.id)),
    exercises: exercises.map((e) => ({ id: e.id, title: e.title, deadline: e.deadline ? e.deadline.toISOString() : null })),
    rows,
  };
}

export interface HandInDetail {
  id: number;
  student: { id: number; name: string };
  exercise: { id: string; title: string; deadline: string | null };
  submittedAt: string;
  late: boolean;
  exerciseVersion: string;
  testSummary: TestSummary | null;
  files: HandInFile[];
  /** All hand-ins of this student for this exercise, newest first. */
  history: { id: number; submittedAt: string; late: boolean }[];
  /** Neighbouring students (by name) in the course who handed in this exercise, with their last hand-in. */
  previous: { studentId: number; handinId: number } | null;
  next: { studentId: number; handinId: number } | null;
}

export async function handInDetail(db: SQLInstance, teacherId: number, handinId: number): Promise<HandInDetail> {
  const rows = await db<
    {
      id: number; studentId: number; studentName: string; courseId: number; exerciseRowId: number; slug: string; title: string;
      submittedAt: Date; version: string; passed: number | null; total: number | null; deadline: Date | null;
    }[]
  >`
    SELECT h.id, s.id AS studentId, s.name AS studentName, s.course_id AS courseId, e.id AS exerciseRowId, e.slug, e.title,
           h.submitted_at AS submittedAt, h.exercise_version AS version, h.tests_passed AS passed, h.tests_total AS total,
           (SELECT ce.deadline FROM course_exercises ce WHERE ce.course_id = s.course_id AND ce.exercise_id = e.id) AS deadline
    FROM handins h
    JOIN students s ON s.id = h.student_id
    JOIN courses c ON c.id = s.course_id AND c.teacher_id = ${teacherId}
    JOIN exercises e ON e.id = h.exercise_id
    WHERE h.id = ${handinId}
  `;
  const h = rows[0];
  if (!h) throw new AppError(404, 'NOT_FOUND', 'Abgabe nicht gefunden.');

  const history = await db<{ id: number; submittedAt: Date }[]>`
    SELECT id, submitted_at AS submittedAt FROM handins
    WHERE student_id = ${h.studentId} AND exercise_id = ${h.exerciseRowId} ORDER BY id DESC
  `;
  // Students with a hand-in for this exercise, in name order, with their last hand-in.
  const handedIn = await db<{ studentId: number; handinId: number }[]>`
    SELECT s.id AS studentId, MAX(x.id) AS handinId
    FROM students s JOIN handins x ON x.student_id = s.id AND x.exercise_id = ${h.exerciseRowId}
    WHERE s.course_id = ${h.courseId}
    GROUP BY s.id, s.name ORDER BY s.name, s.id
  `;
  const at = handedIn.findIndex((r) => r.studentId === h.studentId);
  const pick = (r: { studentId: number; handinId: number } | undefined) => (r ? { studentId: r.studentId, handinId: Number(r.handinId) } : null);

  return {
    id: h.id,
    student: { id: h.studentId, name: h.studentName },
    exercise: { id: h.slug, title: h.title, deadline: h.deadline ? h.deadline.toISOString() : null },
    submittedAt: h.submittedAt.toISOString(),
    late: isLate(h.submittedAt, h.deadline),
    exerciseVersion: h.version,
    testSummary: summaryOf(h.passed, h.total),
    files: await filesOf(db, h.id),
    history: history.map((x) => ({ id: x.id, submittedAt: x.submittedAt.toISOString(), late: isLate(x.submittedAt, h.deadline) })),
    previous: at > 0 ? pick(handedIn[at - 1]) : null,
    next: at >= 0 ? pick(handedIn[at + 1]) : null,
  };
}

// ---- zip ----

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A folder name that is valid on Windows (and everywhere else). */
export function safeFolderName(name: string): string {
  let n = name.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();
  n = n.replace(/[. ]+$/, '');
  if (n === '' || /^\.+$/.test(n)) n = 'Schüler';
  if (RESERVED.test(n.split('.')[0]!)) n = `_${n}`;
  return n.slice(0, 80).replace(/[. ]+$/, '');
}

/** Sanitised names; clashes (case-insensitive, as on Windows) get " (2)", " (3)", ... */
export function uniqueFolderNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const base = safeFolderName(name);
    let candidate = base;
    for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base} (${i})`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Zip of the last hand-in of every student of the course for one exercise; one folder per student. */
export async function lastHandInsZip(db: SQLInstance, courseId: number, exerciseRowId: number): Promise<Uint8Array> {
  const last = await db<{ id: number; name: string }[]>`
    SELECT MAX(h.id) AS id, s.name
    FROM students s JOIN handins h ON h.student_id = s.id AND h.exercise_id = ${exerciseRowId}
    WHERE s.course_id = ${courseId}
    GROUP BY s.id, s.name ORDER BY s.name, s.id
  `;
  const folders = uniqueFolderNames(last.map((l) => l.name));
  const zippable: Zippable = {};
  for (const [i, l] of last.entries()) {
    for (const f of await filesOf(db, Number(l.id))) zippable[`${folders[i]}/${f.path}`] = strToU8(f.content);
  }
  return zipSync(zippable);
}
