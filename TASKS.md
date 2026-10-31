# M1 – Local IDE (target 2026-11-08) – done 2026-10-30

Each task ends with something that runs. See SPEC.md for details and the Figma file for the screens.
Implementation is done by Sonnet subagents; planning, review and debugging stay in the main (Opus) session.

- [x] **T1 Scaffold** – npm workspaces (`app`, `shared`), Electron + electron-vite + TypeScript, Monaco in an empty window.
  - Done when: `npm run dev` opens a window with a Java-highlighted editor; `npm run build` and `npm test` pass.
- [x] **T2 Exercise loader** (`shared`) – parse `exercise.yaml`, copy the exercise into a local workspace on first open, never overwrite student files on update.
  - Done when: unit tests for parsing, the first copy and the update rule pass, using `examples/summe`.
- [x] **T3 Java helper** (`java-helper`) – long-running process, JSON over stdin/stdout. `compile` (in memory, `--release 25`, German messages) returns diagnostics; harness appended to the target file.
  - Done when: integration tests pass: a syntax error is reported in the right line, the harness compiles, and an error inside the harness is flagged as such.
- [x] **T4 Editor UI** – file tree, tabs, read-only files, rendered assignment panel (Markdown → sanitized HTML), local autosave.
  - Done when: `examples/summe` opens and edits survive an app restart.
- [x] **T5 Live errors** – compile 500 ms after typing stops → Monaco markers + "Probleme" list.
  - Done when: a missing `;` shows a red squiggle within ~1 s.
- [x] **T6 Run + console** – compile to a temp dir, start `java`, xterm.js console with stdin, Stopp button, 1 MB output cap, clickable exception lines.
  - Done when: a Scanner program reads two numbers and prints the sum; an endless loop can be stopped.
- [x] **T7 Completion** – keywords/snippets, curated class catalogue (IO, String, Math, Scanner, Random, …), identifiers in the file, `sc.` member heuristic.
  - Done when: typing `Math.` lists `max`, `abs`, `sqrt`… with German descriptions.

Windows packaging (installer + bundled JDK) moves to M2, so it's ready for 2026-11-20.

# Before M2 (planned for 2026-10-31)

- [x] **Rename** the tool from "jide" to **J;DE** (for Java IDE). Renamed user-visible places only: window and page title, German UI texts (Java-helper restart message), `productName` "JDE" (app data folder/installer), package description, design mockups and SPEC title. Internal identifiers (npm packages, IPC channels, JIDE_* env vars, Java package, repo name) stay "jide".
- [x] **App icon**: design up to four icon sketches in Figma; the user picks one, then use it for the app (window, installer, logo mark). Chosen: "J;" on blue (Figma page "App-Icon"); files in `app/resources/` (svg, png 512, multi-size ico for the installer).

# M2 – Backend + online mode (due 2026-11-19)

Decisions (2026-10-31): auto-update from GitHub Releases (public repo `mfreimueller/jide`); backend + teacher app on the parsonxam Uberspace account under a new subdomain, own service, port and database; domain and SMTP values stay out of the repo (gitignored `.deploy.env`, as in parsonxam); hand-ins and exercise zips are stored in MariaDB; the student app keeps working on cached exercises when the server can't be reached; no Windows machine → Windows build and smoke tests run on a GitHub Actions Windows runner.
Copy from parsonxam (`~/git/Personal/_work/parsonxam`) rather than reinventing: config, db + migrations, errors, CORS, rate limiter, mailer, teacher auth, deploy scripts, teacher SPA shell.
Test summaries in hand-ins stay empty until M3.

- [x] **T8 Backend scaffold** (`backend/` workspace) – Hono + zod + mysql2 from parsonxam: config, migration runner, errors, CORS, health, rate limiter, mailer (logs mails when no SMTP host), teacher sign-in link → hashed 30-day session, `teacher:add` script. `docker-compose.yml` with MariaDB on a port that doesn't clash with parsonxam.
  - Done when: API tests for health and teacher sign-in (request link, verify, single use, expiry, rate limit) pass against the docker MariaDB.
- [ ] **T9 Windows packaging + CI** – electron-builder NSIS per-user installer (no admin) `JDE-Setup-<version>.exe`, Start-menu name "J;DE", `app/resources/icon.ico`; bundled jlink'd Temurin JDK 25 (with `jdk.compiler`) and the java-helper jar; the app finds the bundled JDK when packaged. electron-updater with the GitHub provider. GitHub Actions: tests on every push (macOS + Windows), tag `v*` → build on Windows, silent install, launch smoke test, publish the release.
  - Done when: a tagged release builds in CI, the installed app passes the smoke test on the Windows runner, and a second tag is offered as an update (checked from CI logs).
- [x] **T10 Courses + students** – tables, teacher routes: create/archive course, paste names → personal codes (8 chars, unambiguous alphabet, `XXXX-XXXX`, case-insensitive), reset code, list with last activity and hand-in count. `POST /api/student/login`, student `Bearer` middleware (rate-limited per IP, updates last activity).
  - Done when: API tests pass, incl. "reset makes the old code fail at once" and code normalisation (lower case, with/without dash).
- [x] **T11 Exercises** – teacher: upload zip (validated with the `@jide/shared` parser, size limit, stored in MariaDB, re-upload replaces the package), unlock/hide per course, optional soft deadline per course. Student: `GET /api/exercises`, `GET /api/exercises/:id` (zip).
  - Done when: API tests pass, incl. a broken zip rejected with a German message and a hidden exercise not visible/downloadable for students.
- [x] **T12 Hand-ins** – `POST /api/exercises/:id/handins` (editable files only, size limit, server timestamp, late flag from the course deadline), `GET …/handins/latest`. Teacher: matrix students × exercises, hand-in detail with history, zip of all last hand-ins of one exercise (one folder per student).
  - Done when: API tests pass, incl. unit tests for the late logic and "last hand-in counts".
- [ ] **T13 App online mode** – code entry screen (as in Figma), code stored in user data, sent as `Bearer`; exercise list from the backend, packages cached locally (student files never overwritten on update); offline → cached exercises with a hint; "Abgeben" uploads (offline → "Keine Verbindung"); on a new laptop the last hand-in is the starting point; 401 → back to the code screen with a message. API URL set at build time.
  - Done when: e2e tests pass against a local backend (login, list, open, hand in, restore on a fresh user-data dir, offline start).
- [x] **T14 Teacher app** (`teacher/`) – SvelteKit SPA from parsonxam: sign-in, courses, students + printable code sheet (A4 slips), exercises (upload, unlock, deadline, exam-package export may wait for M4), hand-in matrix with "only missing" filter, hand-in detail (highlighted read-only code, history, previous/next student), zip download. Design: `docs/design/teacher-web.html`.
  - Done when: svelte-check passes and a manual walk-through against the local backend covers every screen.
- [ ] **T15 Deploy** – bundle the backend (e.g. esbuild) because it imports `@jide/shared` as TypeScript source; `scripts/deploy-backend.sh`, `scripts/deploy-teacher.sh`, `.deploy.env.example`, `docs/deployment.md` (one-time Uberspace setup as in parsonxam).
  - Done when: the user has run the one-time setup, `/api/health` answers on the real domain and a sign-in mail arrives.
- [ ] **T16 Rehearsal** – real server: course with two test students, both sample exercises uploaded and unlocked, the released Windows app (CI) logs in, downloads, hands in; the hand-ins show up in the teacher view.
  - Done when: done once end to end before 2026-11-18.

Order: T8 and T9 first (T9 is the biggest risk without a Windows machine), then T10 → T11 → T12 → T13, T14 alongside, T15/T16 last.
