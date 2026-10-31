import { Hono } from 'hono';
import { AppError } from './errors.js';
import { corsMiddleware } from './middleware/cors.js';
import { exerciseRoutes } from './routes/exercises.js';
import { studentExerciseRoutes } from './routes/student_exercises.js';
import { health } from './routes/health.js';
import { courseRoutes } from './routes/courses.js';
import { studentHandInRoutes } from './routes/handins.js';
import { teacherHandInRoutes } from './routes/teacher_handins.js';
import { studentRoutes } from './routes/student.js';
import { teacherAuthRoutes } from './routes/teacher_auth.js';

export const app = new Hono();

app.use('/api/*', corsMiddleware);

app.route('/api/health', health);
app.route('/api/teacher', teacherAuthRoutes);
app.route('/api/teacher/courses', courseRoutes);
app.route('/api/teacher/exercises', exerciseRoutes);
app.route('/api/teacher/handins', teacherHandInRoutes);
app.route('/api/exercises', studentExerciseRoutes);
app.route('/api/exercises', studentHandInRoutes);
app.route('/api/student', studentRoutes);

app.notFound((c) => c.json({ error: 'NOT_FOUND', message: 'No such route.' }, 404));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message, ...err.extra }, err.status);
  }
  console.error(`${c.req.method} ${c.req.path}`, err);
  return c.json({ error: 'INTERNAL', message: 'Something went wrong.' }, 500);
});
