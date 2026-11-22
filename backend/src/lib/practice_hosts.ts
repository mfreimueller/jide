import { MAX_PRACTICE_HOSTS, normalisePracticeHost } from '@jide/shared';
import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';
import { courseForTeacher } from './courses.js';

/** Normalises, de-duplicates and sorts; 400 with a German message on an invalid host or more than 20 hosts. */
export function parsePracticeHosts(raw: string[]): string[] {
  const hosts = new Set<string>();
  for (const input of raw) {
    const host = normalisePracticeHost(input);
    if (!host) {
      throw new AppError(400, 'VALIDATION', `„${input.slice(0, 60)}“ ist kein gültiger Hostname (z. B. die-spengergasse.github.io).`);
    }
    hosts.add(host);
  }
  if (hosts.size > MAX_PRACTICE_HOSTS) throw new AppError(400, 'VALIDATION', `Höchstens ${MAX_PRACTICE_HOSTS} Hosts pro Kurs.`);
  return [...hosts].sort();
}

export async function listPracticeHosts(db: SQLInstance, courseId: number): Promise<string[]> {
  const rows = await db<{ host: string }[]>`SELECT host FROM course_practice_hosts WHERE course_id = ${courseId} ORDER BY host`;
  return rows.map((r) => r.host);
}

export async function listPracticeHostsForTeacher(db: SQLInstance, teacherId: number, courseId: number): Promise<string[]> {
  await courseForTeacher(db, teacherId, courseId);
  return listPracticeHosts(db, courseId);
}

/** Replaces the whole list in one transaction; returns the normalised, sorted list. */
export async function replacePracticeHosts(db: SQLInstance, teacherId: number, courseId: number, raw: string[]): Promise<string[]> {
  await courseForTeacher(db, teacherId, courseId);
  const hosts = parsePracticeHosts(raw);
  await db.begin(async (tx) => {
    await tx`DELETE FROM course_practice_hosts WHERE course_id = ${courseId}`;
    for (const host of hosts) await tx`INSERT INTO course_practice_hosts (course_id, host) VALUES (${courseId}, ${host})`;
  });
  return hosts;
}
