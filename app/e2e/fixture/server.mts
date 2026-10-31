// Starts the real backend (src/app.ts) on a free port against a throw-away MariaDB database and seeds it:
// one teacher, course 1AHIF/POS, student "Anna Huber", and the folders of examples/ uploaded and unlocked.
// Prints one line `READY {json}`; on SIGTERM it drops the database again.
// Needs the MariaDB of docker-compose.yml (port 3307). Run with tsx, never bundled.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { zipSync, type Zippable } from "fflate";
import { app } from "../../../backend/src/app.js";
import { createTestDb, dropTestDb, setDb } from "../../../backend/src/db/connection.js";
import { addStudents, createCourse, resetCode } from "../../../backend/src/lib/courses.js";
import { validatePackage } from "../../../backend/src/lib/exercise_package.js";
import { saveExercise, updateForCourse } from "../../../backend/src/lib/exercises.js";
import { addTeacher } from "../../../backend/src/lib/teachers.js";

const examples = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples");

function zipFolder(dir: string): Uint8Array {
  const out: Zippable = {};
  const walk = (d: string, rel: string): void => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, r);
      else out[`${path.basename(dir)}/${r}`] = readFileSync(full);
    }
  };
  walk(dir, "");
  return zipSync(out);
}

const testDb = await createTestDb();
setDb(testDb.db);
const db = testDb.db;

const { teacher } = await addTeacher(db, "lehrkraft@example.org", "Test Lehrkraft");
const course = await createCourse(db, teacher.id, "POS", "1AHIF");
const [student] = await addStudents(db, course.id, ["Anna Huber"]);

for (const name of readdirSync(examples)) {
  if (!statSync(path.join(examples, name)).isDirectory()) continue;
  const pkg = await validatePackage(zipFolder(path.join(examples, name)));
  await saveExercise(db, teacher.id, pkg);
  await updateForCourse(db, teacher.id, course.id, pkg.id, {
    unlocked: true,
    deadline: pkg.id === "summe" ? new Date("2031-11-27T22:59:00Z") : undefined
  });
}

// Test-only control routes in front of the unchanged backend app.
const server = serve(
  {
    port: 0,
    fetch: async (req: Request) => {
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname === "/__test/reset-code") {
        const s = await resetCode(db, course.id, student!.id);
        return Response.json({ code: s.code });
      }
      return app.fetch(req);
    }
  },
  (info) => {
    process.stdout.write(`READY ${JSON.stringify({ url: `http://127.0.0.1:${info.port}`, code: student!.code })}\n`);
  }
);

async function shutdown(): Promise<void> {
  server.close();
  await dropTestDb(testDb).catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
