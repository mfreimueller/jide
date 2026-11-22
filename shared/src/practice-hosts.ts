// Practice-zip hosts a teacher allows per course (SPEC §3.6a / §3.7). Pure, shared by backend and teacher web.

export const MAX_PRACTICE_HOSTS = 20;

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Trims and lower-cases a host name and returns it if it is a plain DNS name
 * (at least one dot, labels [a-z0-9-] of 1-63 chars not starting/ending with "-", at most 253 chars in total,
 * last label not all digits so IP literals are out). Anything else, including ports, paths, credentials and spaces, gives null.
 */
export function normalisePracticeHost(raw: string): string | null {
  const host = raw.trim().toLowerCase();
  if (host.length === 0 || host.length > 253) return null;
  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((l) => LABEL.test(l))) return null;
  if (/^[0-9]+$/.test(labels[labels.length - 1]!)) return null;
  return host;
}
