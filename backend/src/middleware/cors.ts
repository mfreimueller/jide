import { cors } from 'hono/cors';
import { config } from '../config.js';

export const corsMiddleware = cors({
  origin: (origin) => (config().allowedOrigins.includes(origin) ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  exposeHeaders: ['Content-Disposition'],
  maxAge: 600,
});
