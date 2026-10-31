import { randomInt } from 'node:crypto';

// No 0/O, 1/I/L: students read these off a printed slip.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

export function generateAccessCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** "k7m2-qx9a", "k7m2 qx9a" -> "K7M2QX9A". Returns null when the input cannot be a code. */
export function normaliseCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** "K7M2QX9A" -> "K7M2-QX9A" */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
