import { Hono } from 'hono';
import { z } from 'zod';
import { parseJson } from '../lib/http.js';
import {
  authenticateStudent,
  studentAuth,
  type Student,
  type StudentVariables,
} from '../middleware/student_auth.js';

export const studentRoutes = new Hono<{ Variables: StudentVariables }>();

const loginSchema = z.object({ code: z.string({ message: 'Bitte gib deinen Code ein.' }).max(50, 'Dieser Code ist ungültig.') });

function view(s: Student) {
  return { name: s.name, course: { subject: s.subject, className: s.className } };
}

studentRoutes.post('/login', async (c) => {
  const { code } = await parseJson(c, loginSchema);
  return c.json(view(await authenticateStudent(c, code)));
});

// All later student routes mount behind studentAuth.
studentRoutes.get('/me', studentAuth, (c) => c.json(view(c.get('student'))));
