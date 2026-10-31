process.env.TZ = 'UTC';

import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { SQL, type SQLInstance } from './sql.js';
import { runMigrations } from './migrate.js';

let _db: SQLInstance | null = null;

export function getDb(): SQLInstance {
  if (_db) return _db;
  _db = SQL(config().databaseUrl);
  return _db;
}

export function setDb(db: SQLInstance): void {
  _db = db;
}

export function resetDb(): void {
  _db = null;
}

export interface TestDb {
  db: SQLInstance;
  dbName: string;
}

export async function createTestDb(): Promise<TestDb> {
  const adminUrl = config().testAdminUrl;
  const admin = SQL(adminUrl);
  const dbName = `jide_test_${randomUUID().replace(/-/g, '')}`;
  await admin.unsafe(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.close();

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const db = SQL(url.toString());
  await runMigrations(db);
  return { db, dbName };
}

export async function dropTestDb(testDb: TestDb): Promise<void> {
  await testDb.db.close();
  const admin = SQL(config().testAdminUrl);
  await admin.unsafe(`DROP DATABASE IF EXISTS \`${testDb.dbName}\``);
  await admin.close();
}
