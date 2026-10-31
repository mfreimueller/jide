import { afterAll, beforeAll } from 'vitest';
import { createTestDb, dropTestDb, setDb, resetDb, type TestDb } from '../src/db/connection.js';

// Gives the test file its own migrated database and points the app at it.
export function useTestDb(): { current: () => TestDb } {
  let testDb: TestDb;
  beforeAll(async () => {
    testDb = await createTestDb();
    setDb(testDb.db);
  });
  afterAll(async () => {
    resetDb();
    await dropTestDb(testDb);
  });
  return { current: () => testDb };
}

import { app } from '../src/app.js';
import type { SQLInstance } from '../src/db/sql.js';
import { createSession } from '../src/lib/teacher_auth.js';
import { addTeacher } from '../src/lib/teachers.js';

export interface TestTeacher {
  id: number;
  email: string;
  call: (method: string, path: string, body?: unknown) => Promise<Response>;
}

// A signed-in teacher whose requests go straight to the app.
export async function signedInTeacher(db: SQLInstance, email: string, name: string): Promise<TestTeacher> {
  const { teacher } = await addTeacher(db, email, name);
  const { token } = await createSession(db, teacher.id);
  return {
    id: teacher.id,
    email: teacher.email,
    call: async (method, path, body) =>
      app.request(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  };
}
