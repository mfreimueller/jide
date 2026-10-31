import { getDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { addTeacher } from '../lib/teachers.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ');
if (!email || !name || !email.includes('@')) {
  console.error('Usage: add_teacher <email> "<Display Name>"');
  process.exit(1);
}

const db = getDb();
await runMigrations(db);
const { created, teacher } = await addTeacher(db, email, name);
console.log(created ? `Created teacher #${teacher.id} ${teacher.email}` : `Teacher ${teacher.email} already exists (#${teacher.id})`);
await db.close();
