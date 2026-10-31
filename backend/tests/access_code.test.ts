import { describe, it, expect } from 'vitest';
import { CODE_ALPHABET, formatCode, generateAccessCode, normaliseCode } from '../src/lib/access_code.js';

describe('access codes', () => {
  it('has 31 unambiguous characters', () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    for (const bad of '01OIL') expect(CODE_ALPHABET).not.toContain(bad);
  });

  it('generates 8 characters from the alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('formats as XXXX-XXXX', () => {
    expect(formatCode('K7M2QX9A')).toBe('K7M2-QX9A');
  });

  it('normalises case, dash and spaces', () => {
    for (const input of ['k7m2-qx9a', 'K7M2QX9A', ' k7m2 qx9a ', 'k7m2qx9a', 'K7M2 - QX9A']) {
      expect(normaliseCode(input)).toBe('K7M2QX9A');
    }
  });

  it('rejects impossible codes', () => {
    for (const input of ['', 'K7M2QX9', 'K7M2QX9AB', 'K7M2QX90', 'K7M2QXIA', 'K7M2-QX9!']) {
      expect(normaliseCode(input)).toBeNull();
    }
  });
});
