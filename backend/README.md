# @jide/backend

Hono + MariaDB backend for J;DE (teacher sign-in so far; courses, exercises and hand-ins follow).

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
