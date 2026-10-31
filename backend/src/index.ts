process.env.TZ = 'UTC';

import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';

await runMigrations(getDb());
const { port } = config();
serve({ fetch: app.fetch, port });
console.log(`jide-backend listening on :${port}`);
