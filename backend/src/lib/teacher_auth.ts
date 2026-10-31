import type { SQLInstance } from '../db/sql.js';
import { AppError } from '../errors.js';
import { config } from '../config.js';
import { generateToken } from './token.js';
import { hashToken } from './hash.js';
import { sendMail } from './mailer.js';
import type { Teacher } from './teachers.js';

export const LOGIN_LINK_MS = 15 * 60 * 1000;
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

// Creates a link for a known teacher and mails it. Does nothing for unknown emails.
// The caller answers 202 in both cases; mail is sent in the background so response
// time does not reveal whether the address exists.
export async function requestLoginLink(db: SQLInstance, email: string): Promise<void> {
  const rows = await db<Teacher[]>`
    SELECT id, email, display_name AS displayName FROM teachers WHERE email = ${email}
  `;
  const teacher = rows[0];
  if (!teacher) return;

  const token = generateToken();
  const now = new Date();
  await db`
    INSERT INTO login_tokens (teacher_id, token_hash, expires_at, created_at)
    VALUES (${teacher.id}, ${hashToken(token)}, ${new Date(now.getTime() + LOGIN_LINK_MS)}, ${now})
  `;

  const link = `${config().publicTeacherUrl}/auth/verify?token=${token}`;
  void sendMail({
    to: teacher.email,
    subject: 'Dein J;DE-Anmeldelink',
    text:
      `Hallo ${teacher.displayName},\n\nmit diesem Link meldest du dich bei J;DE an:\n${link}\n\n` +
      `Der Link funktioniert nur einmal und ist 15 Minuten gültig. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
    html:
      `<p>Hallo ${escapeHtml(teacher.displayName)},</p><p><a href="${link}">Bei J;DE anmelden</a></p>` +
      `<p>Der Link funktioniert nur einmal und ist 15 Minuten gültig. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>`,
  }).catch((err) => console.error('sign-in mail failed', err));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export async function verifyLoginLink(
  db: SQLInstance,
  token: string
): Promise<{ token: string; expiresAt: Date; teacher: Teacher }> {
  const hash = hashToken(token);
  const now = new Date();

  // Claim the link atomically so two concurrent requests cannot both succeed.
  const claim = await db`
    UPDATE login_tokens SET used_at = ${now}
    WHERE token_hash = ${hash} AND used_at IS NULL AND expires_at > ${now}
  `;
  if (claim.affectedRows !== 1) {
    const rows = await db<{ expiresAt: Date; usedAt: Date | null }[]>`
      SELECT expires_at AS expiresAt, used_at AS usedAt FROM login_tokens WHERE token_hash = ${hash}
    `;
    const row = rows[0];
    if (row && !row.usedAt && row.expiresAt <= now) {
      throw new AppError(410, 'LINK_EXPIRED', 'This sign-in link has expired.');
    }
    throw new AppError(400, 'LINK_INVALID', 'This sign-in link is not valid or was already used.');
  }

  const rows = await db<(Teacher & { teacherId: number })[]>`
    SELECT t.id, t.email, t.display_name AS displayName
    FROM login_tokens l JOIN teachers t ON t.id = l.teacher_id
    WHERE l.token_hash = ${hash}
  `;
  const teacher = rows[0]!;
  const session = await createSession(db, teacher.id);
  return { ...session, teacher: { id: teacher.id, email: teacher.email, displayName: teacher.displayName } };
}

export async function createSession(db: SQLInstance, teacherId: number) {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MS);
  await db`
    INSERT INTO teacher_sessions (teacher_id, token_hash, expires_at, created_at)
    VALUES (${teacherId}, ${hashToken(token)}, ${expiresAt}, ${now})
  `;
  return { token, expiresAt };
}

export async function deleteSession(db: SQLInstance, token: string): Promise<void> {
  await db`DELETE FROM teacher_sessions WHERE token_hash = ${hashToken(token)}`;
}
