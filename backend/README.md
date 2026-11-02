# @jide/backend

Hono + MariaDB backend for J;DE (teacher sign-in, courses, students and exercises and hand-ins).

## Exercises API

Teacher routes need the teacher `Bearer` token, student routes the student code. Exercises belong to the uploading teacher (others get 404). The API takes deadlines as ISO 8601 instants and stores UTC; the teacher UI converts from Vienna time.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/teacher/exercises` | list: `id, title, version, uploadedAt, size` |
| POST | `/api/teacher/exercises` | upload (see below); 201 new, 200 replaced; body `{ exercise, replaced }` |
| GET | `/api/teacher/exercises/:id` | one exercise |
| GET | `/api/teacher/courses/:courseId/exercises` | all of the teacher's exercises with `unlocked` and `deadline` for this course |
| PUT | `/api/teacher/courses/:courseId/exercises/:id` | JSON `{ unlocked?: boolean, deadline?: ISO string \| null }` (at least one); `null` clears the deadline |
| GET / POST | `/api/teacher/courses/:courseId/groups` | groups of the course in order `{ groups: [{id, name}] }` / create `{ name }` (201 `{ group }`; 409 `Diese Gruppe gibt es schon.` for a duplicate name in the course) |
| PUT / DELETE | `/api/teacher/courses/:courseId/groups/:groupId` | rename `{ name }` / delete (204; its exercises become ungrouped) |
| POST | `/api/teacher/courses/:courseId/groups/:groupId/move` | `{ direction: "up" \| "down" }`: swaps with the neighbour, no-op at the edge; answers `{ groups }` |
| PUT | `/api/teacher/courses/:courseId/exercises/:id` | also takes `groupId: number \| null` (appends to that group's end / takes it out of its group) |
| POST | `/api/teacher/courses/:courseId/exercises/:id/move` | `{ direction }` inside its group (400 if ungrouped); answers `{ exercises, groups }` |
| GET | `/api/exercises` | student: unlocked exercises of the own course (`id, title, version, deadline, groupId`) plus `groups` (`[{id, name}]` in order, only groups with a visible exercise) |
| GET | `/api/exercises/:id` | student: the package zip; 404 unless unlocked; `ETag: "<version>"`, `If-None-Match` gives 304 |

`:id` is the exercise id from `exercise.yaml`. Types of the student API are in `@jide/shared` (`shared/src/api.ts`).

**Upload**: raw request body (`Content-Type: application/zip`), not multipart. Limit 10 MB (413, counted while streaming); at most 500 files and 50 MB unpacked; no `..`, absolute or backslash paths, no symlinks (400, German message). The zip holds one exercise in the SPEC §4 format, either as a single folder (`summe/exercise.yaml`) or with the files at the root (`exercise.yaml`). It is validated with the `@jide/shared` parser (the same one the app uses), then **re-packed as a single folder `<id>/`** (sorted, fixed timestamps) and stored in the `exercises.package` LONGBLOB. `version` is the sha256 of that stored zip, so identical content has an identical version. Re-uploading the same `id` replaces the package and keeps unlocks and deadlines.

The backend imports `@jide/shared` as TypeScript source (npm workspace). `shared/src` therefore uses `.js` import extensions; `npm run build -w @jide/backend` therefore bundles with esbuild into self-contained `dist/index.js` and `dist/add_teacher.js` (no `node_modules` needed on the server). See `docs/deployment.md`.

All commands run from the repo root.

## Hand-ins API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/exercises/:id/handins` | student: JSON `{ files: [{path, content}], testSummary: {passed, total} \| null }` (`testSummary` optional); 201 `{ submittedAt, late }`. 404 unless unlocked; 400 for unknown/read-only/duplicate paths; max 50 files (400) and 1 MB UTF-8 content (413). Server time only. |
| GET | `/api/exercises/:id/handins/latest` | student: `{ submittedAt, files }` of the last hand-in, 404 if none |
| GET | `/api/teacher/courses/:courseId/handins` | matrix `{ students, exercises, rows }`; `rows[i].cells[j]` = last hand-in of `students[i]` for `exercises[j]` (`handinId, submittedAt, late, testSummary, count`) or `null`. `?missing=1` keeps only students lacking a hand-in for an unlocked exercise (server side). |
| GET | `/api/teacher/handins/:handinId` | `{ handin }` with student, exercise, files, `history` (newest first), `previous`/`next` (`{studentId, handinId}` of the neighbouring students by name who handed in this exercise) |
| GET | `/api/teacher/courses/:courseId/exercises/:id/handins.zip` | last hand-in of every student, folder per student (Windows-safe name, clashes get ` (2)`) |

Storage: `handins` (student, exercise row, `submitted_at` UTC server time, `exercise_version`, `tests_passed`/`tests_total`) and `handin_files` (one row per file, `content` MEDIUMTEXT). Every hand-in is kept; the highest id of a student and exercise counts. `late` is never stored: it is computed on read as `submitted_at > current course deadline`, so extending a deadline un-marks late hand-ins. `handInCount`/`unlockedExerciseCount` in the student list count unlocked exercises only.

## Database

```sh
docker compose up -d        # MariaDB 11 on localhost:3307 (db/user/password: jide)
```

Port 3307 avoids a clash with parsonxam's MariaDB on 3306.

## Dev server

```sh
cp backend/.env.example backend/.env    # optional, defaults match docker-compose.yml
npm run dev -w backend                  # http://localhost:3000, migrations run on start
```

With `SMTP_HOST` empty, sign-in mails are printed to the console.

## Add a teacher

```sh
npm run teacher:add -w backend -- anna@school.example "Anna Berger"
```

Then request a sign-in link via `POST /api/teacher/auth/request-link`; the link appears in the dev server console.

## Tests

```sh
docker compose up -d
npm test -w backend
```

Each test file creates and drops its own database via `TEST_DATABASE_ADMIN_URL` (root on port 3307 by default).
