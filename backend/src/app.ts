import { Hono } from 'hono';
import { AppError } from './errors.js';
import { corsMiddleware } from './middleware/cors.js';
import { health } from './routes/health.js';
import { teacherAuthRoutes } from './routes/teacher_auth.js';

export const app = new Hono();

app.use('/api/*', corsMiddleware);

app.route('/api/health', health);
app.route('/api/teacher', teacherAuthRoutes);

app.notFound((c) => c.json({ error: 'NOT_FOUND', message: 'No such route.' }, 404));

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message, ...err.extra }, err.status);
  }
  console.error(`${c.req.method} ${c.req.path}`, err);
  return c.json({ error: 'INTERNAL', message: 'Something went wrong.' }, 500);
});
