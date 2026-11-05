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

# M2 – Backend + online mode (due 2026-11-19) – done 2026-11-01

Decisions (2026-10-31): auto-update from GitHub Releases (public repo `mfreimueller/jide`); backend + teacher app on the parsonxam Uberspace account under a new subdomain, own service, port and database; domain and SMTP values stay out of the repo (gitignored `.deploy.env`, as in parsonxam); hand-ins and exercise zips are stored in MariaDB; the student app keeps working on cached exercises when the server can't be reached; no Windows machine → Windows build and smoke tests run on a GitHub Actions Windows runner.
Copy from parsonxam (`~/git/Personal/_work/parsonxam`) rather than reinventing: config, db + migrations, errors, CORS, rate limiter, mailer, teacher auth, deploy scripts, teacher SPA shell.
Test summaries in hand-ins stay empty until M3.

- [x] **T8 Backend scaffold** (`backend/` workspace) – Hono + zod + mysql2 from parsonxam: config, migration runner, errors, CORS, health, rate limiter, mailer (logs mails when no SMTP host), teacher sign-in link → hashed 30-day session, `teacher:add` script. `docker-compose.yml` with MariaDB on a port that doesn't clash with parsonxam.
  - Done when: API tests for health and teacher sign-in (request link, verify, single use, expiry, rate limit) pass against the docker MariaDB.
- [x] **T9 Windows packaging + CI** – electron-builder NSIS per-user installer (no admin) `JDE-Setup-<version>.exe`, Start-menu name "J;DE", `app/resources/icon.ico`; bundled jlink'd Temurin JDK 25 (with `jdk.compiler`) and the java-helper jar; the app finds the bundled JDK when packaged. electron-updater with the GitHub provider. GitHub Actions: tests on every push (macOS + Windows), tag `v*` → build on Windows, silent install, launch smoke test, publish the release.
  - Done when: a tagged release builds in CI, the installed app passes the smoke test on the Windows runner, and a second tag is offered as an update (checked from CI logs).
- [x] **T10 Courses + students** – tables, teacher routes: create/archive course, paste names → personal codes (8 chars, unambiguous alphabet, `XXXX-XXXX`, case-insensitive), reset code, list with last activity and hand-in count. `POST /api/student/login`, student `Bearer` middleware (rate-limited per IP, updates last activity).
  - Done when: API tests pass, incl. "reset makes the old code fail at once" and code normalisation (lower case, with/without dash).
- [x] **T11 Exercises** – teacher: upload zip (validated with the `@jide/shared` parser, size limit, stored in MariaDB, re-upload replaces the package), unlock/hide per course, optional soft deadline per course. Student: `GET /api/exercises`, `GET /api/exercises/:id` (zip).
  - Done when: API tests pass, incl. a broken zip rejected with a German message and a hidden exercise not visible/downloadable for students.
- [x] **T12 Hand-ins** – `POST /api/exercises/:id/handins` (editable files only, size limit, server timestamp, late flag from the course deadline), `GET …/handins/latest`. Teacher: matrix students × exercises, hand-in detail with history, zip of all last hand-ins of one exercise (one folder per student).
  - Done when: API tests pass, incl. unit tests for the late logic and "last hand-in counts".
- [x] **T13 App online mode** – code entry screen (as in Figma), code stored in user data, sent as `Bearer`; exercise list from the backend, packages cached locally (student files never overwritten on update); offline → cached exercises with a hint; "Abgeben" uploads (offline → "Keine Verbindung"); on a new laptop the last hand-in is the starting point; 401 → back to the code screen with a message. API URL set at build time.
  - Done when: e2e tests pass against a local backend (login, list, open, hand in, restore on a fresh user-data dir, offline start).
- [x] **T14 Teacher app** (`teacher/`) – SvelteKit SPA from parsonxam: sign-in, courses, students + printable code sheet (A4 slips), exercises (upload, unlock, deadline, exam-package export may wait for M4), hand-in matrix with "only missing" filter, hand-in detail (highlighted read-only code, history, previous/next student), zip download. Design: `docs/design/teacher-web.html`.
  - Done when: svelte-check passes and a manual walk-through against the local backend covers every screen.
- [x] **T15 Deploy** – bundle the backend (e.g. esbuild) because it imports `@jide/shared` as TypeScript source; `scripts/deploy-backend.sh`, `scripts/deploy-teacher.sh`, `.deploy.env.example`, `docs/deployment.md` (one-time Uberspace setup as in parsonxam). Also a short root `README.md`: what J;DE is (one paragraph), repo layout (app, backend, teacher, shared, java-helper, examples), local dev (`docker compose up -d`, `npm install`, `npm run dev`, running the tests), links to SPEC, docs/release.md, docs/deployment.md and the exercise format (SPEC §4). The repo is public: no server values (domain, SMTP, SSH login) in the README.
  - Done when: the user has run the one-time setup, `/api/health` answers on the real domain and a sign-in mail arrives.
  - Server live 2026-10-31 (API + sign-in mail working); v0.2.0 released with the production API URL.
- [x] **T16 Rehearsal** – real server: course with two test students, both sample exercises uploaded and unlocked, the released Windows app (CI) logs in, downloads, hands in; the hand-ins show up in the teacher view.
  - Done when: done once end to end before 2026-11-18.
  - Done 2026-11-01 by the user (deployed and tested).

Order: T8 and T9 first (T9 is the biggest risk without a Windows machine), then T10 → T11 → T12 → T13, T14 alongside, T15/T16 last.

# M3 – Tests (target 2026-11-29, can slip) – done 2026-11-01

Decisions (2026-11-01): the teacher view keeps showing only the summary (`passed/total`), so the backend and teacher app need no change; "Abgeben" asks for confirmation if the last test run failed, tests were never run, or the code changed since the last run (exercises without `tests.yaml` never ask); both sample exercises get a `tests.yaml`.
Exam-mode `allowTests` waits for M4.

- [x] **T17 Test format** (`shared`) – parse `tests.yaml` (SPEC §3.4) with zod: `io` (input, expected, match `exact | contains | trimmed`, default trimmed + whitespace-normalised) and `check` (`call` + `expected`, or a `code` block returning boolean); timeout like `2s`, default 2 s; German error messages. Output comparison function. The exercise loader reads `tests.yaml`, so a broken one is rejected on upload too. Write `tests.yaml` for `examples/summe` and `examples/maximum`.
  - Done when: unit tests for parsing (valid, every invalid case, defaults) and every match mode pass; uploading a zip with a broken `tests.yaml` gives a German error.
- [x] **T18 Java helper `test`** – runs all tests of an exercise in a temp working dir (with `resources/`). `io`: start the main file with the input, compare stdout. `check`: generated code compiled together with the student's file, so students' methods are called directly (no JUnit, no reflection). Per test: passed / failed (expected vs. actual) / error (exception, timeout, compile error); timeout message "Dein Programm hat zu lange gebraucht (Endlosschleife?)". Errors in generated test code are reported as "Fehler im vorgegebenen Code".
  - Spike done 2026-11-01: for a test run append a generated instance `void main(String[] __args)` instead of the harness; the launcher prefers it over `void main()`, it calls the student's methods directly and sees other classes. Each test runs in a daemon thread with `join(timeout)`. A student-written `main(String[])` clashes → clear message. `call` results compared as text (SPEC §3.4).
  - Done when: integration tests cover pass, fail, exception, timeout and compile error for both test types, using the sample exercises.
- [x] **T19 "Testen" in the app** – toolbar button (only when the exercise has tests), test panel in the bottom panel (as in Figma): one row per test, expected vs. actual for failed ones, summary "Dein Code sieht richtig aus!" / "Da sind noch Fehler in deinem Programm.". Compile errors → no run, "Probleme" opens (as for "Ausführen"). The last result is kept per exercise.
  - Done when: e2e test: a correct and a wrong solution of `summe` show the right results and summary.
- [x] **T20 Hand-in with tests** – confirmation dialog "Da sind noch Fehler in deinem Programm. Möchtest du wirklich abgeben?" (see decision above); the hand-in carries the test summary `{ passed, total }` (`null` when not run or no tests).
  - Done when: e2e tests: green run → no dialog; edit after green run → dialog; the summary shows in the teacher matrix.
- [x] **T21 Release** – v0.3.0 with tests, auto-update from 0.2.0 checked (needs the user's OK to publish).

Order: T17 → T18 (spike first, biggest risk) → T19 → T20 → T21.

# M4 – Exam mode (due before the 2nd exam in January; dry run in December)

Decisions (2026-11-01): after a crash or on another exam PC, opening an exercise restores the newer of the autosave and the last hand-in from the hand-in drive (P: follows the student); exercises are copied by hand into `exercises/` (same folder format as for upload; no teacher-app export); no lockdown, J;DE is a normal window; closing asks for confirmation only if the code changed since the last hand-in; the start from the real Angabelaufwerk is tested early (T22), not only at the dry run.
Designs: Figma "jide – Screens", page "Schüler-App", screens 07–11 (09–11 added 2026-11-01).
Exam mode is the same app as online mode, switched on by `exam.json` next to the exe (SPEC §2). It never talks to the network and never auto-updates. Hand-in folders are named after the exercise id.

- [ ] **T22 Exam folder + share test** – the smallest exam mode needed to start it from a share: `exam.json` next to the exe switches to exam mode; all writable Electron dirs (user data, cache, logs) go to `%TEMP%`; Java from `JAVA_HOME`; exercises listed from `exercises/` next to the exe (reuse the local source). CI (dry-run workflow artifact, no release) builds the unpacked Windows folder without the bundled JDK, with a sample `exam.json` and both sample exercises, as `JDE-Exam-<version>.zip`.
  - Done when: the user has started it from the real Angabelaufwerk on an exam PC and reported start-up time and any Windows warnings.
  - Build merged 2026-11-01 (workflow "Exam build", artifact `JDE-Exam-<version>.zip`; CI: 1–2 s start from a local read-only folder, 159 MB zip, 83 files). On the CI runner the app only starts from a network path (mapped drive or UNC) with `--no-sandbox` ("GPU process isn't usable"). Decision 2026-11-01: change nothing until the user has tried the real share with and without `--no-sandbox` (see docs/exam-mode.md).
- [x] **T23 Exam config + JDK** – `exam.json` parsed and validated (zod, in `shared`), broken file → error screen (Figma 09); title shown in the dark exam bar (Figma 07); JDK lookup `jdkPath` → `JAVA_HOME` → `PATH`, version checked (25 or newer), error screen listing what was searched if missing or too old (Figma 10); nothing is ever written next to the exe; no update check and no backend calls in exam mode.
  - Done when: unit tests for the config and the JDK lookup pass; an e2e test starts exam mode from a read-only folder and opens an exercise.
- [x] **T24 Name entry + exam workspace** – start screen as in Figma 07 (exam title, name field, "Prüfung starten", "N Aufgaben · Testen ist erlaubt"), then the exam workspace as in Figma 08: no exercise list, the exercises from `exercises/` are tabs "Aufgabe 1 …" in the toolbar; dark bar with "PRÜFUNG" + name. The name is asked at every start and goes into `abgabe.json`.
  - Done when: e2e test: name → workspace → switch exercises.
- [x] **T25 Hand-in + autosave to the hand-in drive** – "Abgeben" copies the editable files to `<handInPath>\<id>\` and writes `abgabe.json` (name, exercise id, timestamp, test summary), same confirmation as online (T20); `allowTests: false` hides "Testen". Autosave to `<handInPath>\<id>\_autosave\` every ~60 s and on every run/test. Opening an exercise restores the newer of autosave and hand-in. Status in the dark bar "● zuletzt gesichert auf P:\ um HH:MM" (Figma 08); hand-in drive not reachable → amber status + error toast (Figma 11), work stays local and is retried. Closing the app asks only if the code changed since the last hand-in.
  - Done when: e2e tests: hand-in writes files + abgabe.json; autosave appears; restore after restart with an empty user-data dir; unreachable drive shows the message; close confirmation.
- [ ] **T26 Release + dry run** – the release also attaches `JDE-Exam-<version>.zip` (needs the user's OK to publish).
  - Workflow ready 2026-11-01: release.yml runs exam-build.yml (also on every CI run) and attaches the zip. Release waits for the user's share test (sandbox question). Dry run in December on the exam PCs: start from the Angabelaufwerk, name, exercise, test, hand-in to P:, restart on another PC restores the work.
  - Done when: the dry run went through end to end.

Order: T22 first (biggest risk, needs the user on site), then T23 → T24 → T25, T26 last.

# M5 – Backlog before the roll-out (target 2026-11-18)

Decisions (2026-11-02):
- Removing a student archives them: the data stays in the database, but the student is hidden everywhere and their code stops working at once. There is no archive view and no restore; adding them again creates a new student with a new code.
- Removing an exercise deletes it for good: from the exercise list, from every course, and with all its hand-ins. Hiding per course already exists (T11), so there is no extra hide switch.
- Side panels are not remembered across restarts (default layout at every start) and work the same in exam mode.
- Groups belong to a course. An exercise is in one group or in none; ungrouped exercises come last under "Weitere Übungen"; the teacher orders groups and the exercises inside them with up/down buttons. Exam mode has no groups.

- [x] **T27 Remove a student** – migration: `students.archived_at DATETIME NULL`. Teacher route `DELETE /api/teacher/courses/:courseId/students/:id` sets `archived_at`. Archived students are left out of every teacher list, the hand-in matrix, the zip download and the counts; student login and the `Bearer` middleware reject their code with the same 401 as an unknown code (the app then goes back to the code screen, T13). Teacher app: "Entfernen" per student with a confirmation ("<Name> entfernen? Die Person kann sich danach nicht mehr anmelden.").
  - Done when: API tests: removed student's code fails at once (login and an authenticated route), the student is missing from the list, the matrix and the zip, and the hand-ins are still in the database; adding the same name again gives a new code. svelte-check passes.
- [x] **T28 Delete an exercise** – teacher route `DELETE /api/teacher/exercises/:id` (own exercises only); the existing `ON DELETE CASCADE` removes course links, hand-ins and hand-in files. The exercise list (or a small info route) gives the courses it is unlocked in and the number of hand-ins, for the dialog. Teacher app: "Löschen" per exercise with a confirmation naming the courses and the hand-in count ("… und N Abgaben endgültig löschen?"). Student app: the exercise disappears from the list at the next refresh; the local copy on the PC is left alone, and opening an exercise the server no longer knows doesn't crash.
  - Done when: API tests: delete removes exercise, course links and hand-ins; another teacher's exercise gives 404. e2e: after the delete the exercise is gone from the student list. svelte-check passes.
- [x] **T29 Resizable, collapsible panels** – in the student workspace (online and exam mode) "Dateien", "Angabe" and the bottom panel (Ausgabe/Konsole, Tests, Probleme) get a drag handle to resize and a collapse button in the header; a collapsed panel becomes a thin strip that opens again on click; one keyboard shortcut per panel (keys proposed to the user before implementing, checked against Monaco's defaults). Minimum sizes so the editor never disappears. Layout resets at every start. Design in Figma first (user approves).
  - Done when: e2e tests: collapse and reopen each panel by button and by shortcut, resize by dragging; the same in exam mode.
- [x] **T30 Exercise groups** – migration: `exercise_groups (id, course_id, name, position)`, `course_exercises.group_id NULL` + `position`. Teacher routes: create, rename, delete a group (its exercises become ungrouped), move a group up/down, put an exercise into a group or take it out, move it up/down inside the group. `GET /api/exercises` returns the groups in order with their exercises; groups whose exercises are all hidden don't show. Teacher app: groups on the course's exercise page with up/down buttons. Student app: exercise list split into the groups, ungrouped last under "Weitere Übungen". Exam mode unchanged. Design in Figma first (teacher + student view, user approves).
  - Done when: API tests for every group route incl. ordering and "delete group keeps the exercises"; e2e: the student list shows groups in the teacher's order. svelte-check passes.

Order: T27 → T28 (small, needed for daily admin) → T29 → T30.

Added 2026-11-02:
- [x] **T31 Diagrams as read-only files** – `exercise.yaml` gets an optional `images:` list (`path` ending in `.svg`, files live in `files/`; optional `title`). Paths: relative, no `..`, no duplicates, not the same as a Java path; the file must exist; max 2 MB each. `files:` stays Java-only, so compile, run, tests, hand-in, autosave and restore are unchanged. Upload, the student download cache and exam mode all go through `loadExercise`, so the SVGs travel in the existing zip. Student app: images are listed below the Java files (grey picture icon, label = title or file name); clicking one opens a tab in the middle area with an image viewer instead of Monaco (Monaco stays mounted, hidden). Viewer: zoom bar "−  N %  +  |  100 %  |  Einpassen", info "<file> · nur lesen", hint "Strg + Mausrad zoomt · Ziehen/Scrollen verschiebt" always visible; opens fitted (whole image visible, never above 100 %); Ctrl+wheel zooms, scroll/drag pans. The SVG is shown as `<img>` from a data URI (no scripts run). No links from `aufgabe.md`, SVG only, no teacher-app change. Base64 images inside `aufgabe.md` keep working. Figma: Schüler-App screen 15 (approved).
  - Done when: shared tests for the `images` validation; e2e: an exercise with an image lists it, opening it shows the viewer, zoom buttons change the level, switching back to the Java tab shows the editor with its text intact; an exercise without `images:` behaves as before. svelte-check passes.

# M6 – GitHub issues #3 (tests) and #7 (ergonomics)

Decisions (2026-11-05):
- #3: `check` tests (return values, not stdout) stay the recommended way; `io` tests are only for exercises where printing is the point. New io match mode `lines`. In every match mode except `exact`, a comma or dot between two digits counts as the same (German Windows `printf("%.2f")` prints `3,14`). The JVM locale is not changed. Failed io tests get a line-by-line diff in the Tests panel (Figma first).
- #7: Ctrl+/ (comment) and word jumps (Ctrl+Arrow, Option+Arrow on macOS) failed because `monaco.ts` imports only the bare editor core without the `comment` and `wordOperations` contributions. `sout` snippet. Dark mode follows the OS, with a Hell / Dunkel / System override in the View menu that is remembered between starts; also in exam mode (Figma first). All editor aids also work in exam mode. Ctrl+Scroll zoom of the app: not now.

- [x] **T32 Editor shortcuts + `sout`** – import Monaco's `comment` and `wordOperations` contributions in `monaco.ts`; extra binding Ctrl/Cmd+Shift+7 for "toggle line comment" (that is Ctrl+/ on a German keyboard). `sout` snippet → `System.out.println($0);`.
  - Done when: e2e: Ctrl+/ comments and uncomments the current line, Ctrl+Shift+7 does the same, Ctrl+Right moves the cursor by a word; typing `sout` offers the snippet. Existing tests pass.
- [x] **T33 Tolerant io matching** – `match: lines`: every non-empty expected line must equal a whole output line, in order; other output lines (debug prints) before, between and after are ignored; whitespace normalised as in `trimmed`. `trimmed`, `contains` and `lines` treat `,` and `.` between two digits as equal; `exact` unchanged. Default stays `trimmed`. SPEC §3.4: document `lines`, the decimal rule, and the advice to prefer `check` tests.
  - Done when: unit tests for `lines` (extra lines before/between/after, wrong order fails, missing line fails, typo fails) and for the decimal rule in every mode; the zod error message lists `lines`.
- [x] **T34 Diff for failed io tests** – the Tests panel shows expected vs. actual line by line, marking missing, extra and different lines. Figma: Schüler-App screen 16 (approved). `lines`: unneeded output lines grey "ignoriert"; `contains`: no line diff, today's view plus "Dieser Text kommt in deiner Ausgabe nicht vor."; the table shows the normalised lines.
- [x] **T35 Dark mode** – dark Monaco theme, dark CSS for every screen (workspace, panels, console, dialogs, login, exercise list, exam screens), menu "Ansicht" (Electron's View menu, renamed) › "Darstellung" › Hell / Dunkel / System, remembered between starts, default System; in every mode (online, local, exam). Figma: Schüler-App screens 17–19 (approved; colours are a light → dark mapping of the existing palette).
  - Done: `prefers-color-scheme` palette (CSS custom properties in `app.css`), `jide-dark` Monaco theme, dark xterm console, white sheet behind SVG diagrams/assignment images in dark; menu Ansicht › Darstellung (Hell / Dunkel / System) in every mode, stored in `userData/settings.json`, applied via `nativeTheme.themeSource`. e2e: `theme.spec.ts`; `theme-screenshots.spec.ts` (THEME_SCREENSHOTS=<dir>) writes light/dark screenshots.
- [ ] **T36 Ctrl + mouse wheel zooms the app** (issue #7, decided 2026-11-05) – Ctrl+wheel (also Cmd+wheel / trackpad pinch on macOS) zooms the whole app in the same steps as Ansicht › Vergrößern / Verkleinern; over the diagram viewer it keeps zooming only the diagram (T31). Not remembered: 100 % at every start (like the panel layout). Every mode incl. exam. No Figma needed.
  - Done when: e2e: Ctrl+wheel over the editor and over the Angabe changes the app zoom level in both directions; Ctrl+wheel over the diagram viewer changes only the diagram zoom; after a restart the zoom is 100 %.

Order: T32 and T33 (no design needed) in parallel; T34 and T35 after the Figma screens are approved; T36 last.
