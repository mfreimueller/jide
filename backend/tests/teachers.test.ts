import { describe, it, expect } from 'vitest';
import { addTeacher } from '../src/lib/teachers.js';
import { useTestDb } from './helpers.js';

const t = useTestDb();

describe('addTeacher', () => {
  it('creates once and normalises the email', async () => {
    const first = await addTeacher(t.current().db, ' Anna@School.EDU ', 'Anna Berger');
    expect(first.created).toBe(true);
    expect(first.teacher.email).toBe('anna@school.edu');
    const second = await addTeacher(t.current().db, 'anna@school.edu', 'Other Name');
    expect(second.created).toBe(false);
    expect(second.teacher.id).toBe(first.teacher.id);
  });
});
