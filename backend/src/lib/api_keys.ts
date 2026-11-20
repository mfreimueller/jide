import { randomBytes } from 'node:crypto';
import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';
import { hashToken } from './hash.js';

export const KEY_PREFIX_LENGTH = 9; // "jide_" + 4 characters, shown in the list

export interface ApiKeyView {
  id: number;
  name: string;
  /** Start of the key, e.g. `jide_k7Q2`. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** `jide_` + 32 random URL-safe characters. */
export function generateApiKey(): string {
  return `jide_${randomBytes(24).toString('base64url')}`;
}

interface Row {
  id: number;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const toView = (r: Row): ApiKeyView => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  createdAt: r.createdAt.toISOString(),
  lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
});

/** Active (not revoked) keys, newest first. */
export async function listApiKeys(db: SQLInstance, teacherId: number): Promise<ApiKeyView[]> {
  const rows = await db<Row[]>`
    SELECT id, name, prefix, created_at AS createdAt, last_used_at AS lastUsedAt
    FROM api_keys WHERE teacher_id = ${teacherId} AND revoked_at IS NULL ORDER BY created_at DESC, id DESC
  `;
  return rows.map(toView);
}

/** Creates a key; the full key is only returned here. */
export async function createApiKey(db: SQLInstance, teacherId: number, name: string): Promise<{ apiKey: ApiKeyView; key: string }> {
  const key = generateApiKey();
  const now = new Date();
  const res = await db`
    INSERT INTO api_keys (teacher_id, name, token_hash, prefix, created_at)
    VALUES (${teacherId}, ${name}, ${hashToken(key)}, ${key.slice(0, KEY_PREFIX_LENGTH)}, ${now})
  `;
  const rows = await db<Row[]>`
    SELECT id, name, prefix, created_at AS createdAt, last_used_at AS lastUsedAt FROM api_keys WHERE id = ${res.lastInsertRowid}
  `;
  return { apiKey: toView(rows[0]!), key };
}

export async function revokeApiKey(db: SQLInstance, teacherId: number, id: number): Promise<void> {
  const res = await db`UPDATE api_keys SET revoked_at = ${new Date()} WHERE id = ${id} AND teacher_id = ${teacherId} AND revoked_at IS NULL`;
  if (!res.affectedRows) throw new AppError(404, 'NOT_FOUND', 'Schlüssel nicht gefunden.');
}

/** The teacher id of an active key, or null. Marks the key as used. */
export async function teacherIdForKey(db: SQLInstance, key: string): Promise<number | null> {
  const hash = hashToken(key);
  const rows = await db<{ id: number; teacherId: number }[]>`
    SELECT id, teacher_id AS teacherId FROM api_keys WHERE token_hash = ${hash} AND revoked_at IS NULL
  `;
  const row = rows[0];
  if (!row) return null;
  await db`UPDATE api_keys SET last_used_at = ${new Date()} WHERE id = ${row.id}`;
  return row.teacherId;
}
