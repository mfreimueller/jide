import type { SQLInstance } from '../db/sql.js';

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface Teacher {
  id: number;
  email: string;
  displayName: string;
}

export async function addTeacher(
  db: SQLInstance,
  email: string,
  displayName: string
): Promise<{ created: boolean; teacher: Teacher }> {
  const key = normaliseEmail(email);
  const existing = await db<Teacher[]>`
    SELECT id, email, display_name AS displayName FROM teachers WHERE email = ${key}
  `;
  if (existing[0]) return { created: false, teacher: existing[0] };
  const res = await db`
    INSERT INTO teachers (email, display_name, created_at) VALUES (${key}, ${displayName.trim()}, ${new Date()})
  `;
  return { created: true, teacher: { id: res.lastInsertRowid, email: key, displayName: displayName.trim() } };
}
