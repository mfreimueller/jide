# @jide/backend

Hono + MariaDB backend for J;DE (teacher sign-in, courses, students and exercises so far; hand-ins follow).

## Exercises API

Teacher routes need the teacher `Bearer` token, student routes the student code. Exercises belong to the uploading teacher (others get 404). The API takes deadlines as ISO 8601 instants and stores UTC; the teacher UI converts from Vienna time.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/teacher/exercises` | list: `id, title, version, uploadedAt, size` |
| POST | `/api/teacher/exercises` | upload (see below); 201 new, 200 replaced; body `{ exercise, replaced }` |
| GET | `/api/teacher/exercises/:id` | one exercise |
| GET | `/api/teacher/courses/:courseId/exercises` | all of the teacher's exercises with `unlocked` and `deadline` for this course |
| PUT | `/api/teacher/courses/:courseId/exercises/:id` | JSON `{ unlocked?: boolean, deadline?: ISO string \| null }` (at least one); `null` clears the deadline |
| GET | `/api/exercises` | student: unlocked exercises of the own course (`id, title, version, deadline`) |
| GET | `/api/exercises/:id` | student: the package zip; 404 unless unlocked; `ETag: "<version>"`, `If-None-Match` gives 304 |

`:id` is the exercise id from `exercise.yaml`. Types of the student API are in `@jide/shared` (`shared/src/api.ts`).

**Upload**: raw request body (`Content-Type: application/zip`), not multipart. Limit 10 MB (413, counted while streaming); at most 500 files and 50 MB unpacked; no `..`, absolute or backslash paths, no symlinks (400, German message). The zip holds one exercise in the SPEC §4 format, either as a single folder (`summe/exercise.yaml`) or with the files at the root (`exercise.yaml`). It is validated with the `@jide/shared` parser (the same one the app uses), then **re-packed as a single folder `<id>/`** (sorted, fixed timestamps) and stored in the `exercises.package` LONGBLOB. `version` is the sha256 of that stored zip, so identical content has an identical version. Re-uploading the same `id` replaces the package and keeps unlocks and deadlines.

The backend imports `@jide/shared` as TypeScript source (npm workspace). `shared/src` therefore uses `.js` import extensions; T15 (deploy) must bundle or build shared, since `tsc -p tsconfig.build.json` + `node dist` does not compile it.

All commands run from the repo root.

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
