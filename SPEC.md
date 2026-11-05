# J;DE – Spec (Draft v0.1, 2026-10-30)

A minimal Java IDE for first-year HTL students (POS 1xHIF), with exercises distributed by a thin backend and an offline exam mode.

J;DE (for "Java IDE"); the technical name is "JDE" where a semicolon cannot be used (installer file, app data folder). Internal identifiers (npm packages @jide/*, IPC channels, JIDE_* env vars, Java package at.jide.helper, repo name "jide") stay "jide".

## 1. Objective

Students should be able to start working on an exercise without downloading, extracting or opening projects.
They enter a personal code once. From then on they see the exercises the teacher has unlocked, write code, test it against teacher-provided tests and hand it in with one click.

**Users**
- *Students*: 16 students in one 1st-grade class, beginner programmers, own Windows laptops, no admin rights assumed.
- *Teacher*: manages courses, students and exercises, collects hand-ins.

**Scope note**: The app is used by one class for one school year (2026/27). Prefer the simplest thing that works and low maintenance over generality or scalability.

**Success criteria**
- A student goes from "app installed" to "running their first exercise" in under 2 minutes, with no file handling.
- A hand-in reaches the backend with a server-side timestamp and is visible in the teacher view.
- In exam mode the app runs from a read-only network share, with no installation and no internet.

## 2. Modes

| | Online mode | Exam mode |
|---|---|---|
| Runs on | Student laptops (Windows) | School exam PCs (Windows), started from the Angabelaufwerk |
| Distribution | Per-user installer (no admin), auto-update | Unpacked folder copied to the Angabelaufwerk, no installation |
| Activated by | default | `exam.json` next to the exe |
| Identity | Personal code (one per student) | Student types their name at start |
| Exercises from | Backend | `exercises/` folder next to the exe |
| JDK | Bundled JDK 25 | JDK 25 installed on the exam PC, found via `JAVA_HOME` (override: `jdkPath` in `exam.json`) |
| "Testen" | on | on |
| "Abgeben" | Upload to backend | Copy to the configured hand-in drive (default `P:\`, a per-student drive) |
| Autosave | local | to the hand-in drive, every ~60 s and on every run/test |

`exam.json` (example):
```json
{
  "mode": "exam",
  "title": "1. Test POS – Jänner",
  "handInPath": "P:\\",
  "jdkPath": null,
  "allowTests": true
}
```

## 3. Functional requirements

### 3.1 Editor (both modes)
- Monaco editor, German UI. Code font: JetBrains Mono, bundled with the app, ligatures off (editor, assignment code, console).
- Syntax colors as in the design; identifiers starting with an uppercase letter are colored as types (Monaco's Java grammar has no type tokens).
- Autosave; if saving fails the student stays in the exercise and sees "Speichern fehlgeschlagen" (no code is ever discarded).
- Syntax highlighting for Java.
- File tree for multi-file exercises. Files can be marked read-only (e.g. a given class).
- **Auto-compile**: compiles ~500 ms after the student stops typing. Errors and warnings show as red/yellow squiggles and in a "Probleme" list. javac messages are in German.
- **Auto-completion (Option A, no real code analysis)**:
  - Java keywords and snippets (`if`, `for`, `while`, `do`, `switch`, `void main()`, …).
  - A curated catalogue of standard classes and methods used in the slides: `IO`, `System.out`, `String`, `Math`, `Scanner`, `Random`, `Integer`, `Double`, `Character`, `Arrays`, `ArrayList`, `Files`/`Path` (file operations), etc., with short German descriptions.
  - Identifiers already present in the current file.
  - Heuristic member completion: `sc.` → `Scanner` methods if `Scanner sc = …` is declared in the file.
- Assignment text is shown rendered (Markdown → HTML, never raw) in a side panel.

### 3.2 Running programs
- "Ausführen" compiles and runs the program in a built-in console. stdin is fully interactive (`Scanner`).
- Each run starts with an empty console.
- If the code has compile errors, nothing runs: the console says "Dein Programm enthält noch Fehler – schau unter Probleme." and the "Probleme" tab opens.
- A "Stopp" button kills the process. Output is capped at 1 MB: when reached, the program is stopped and the console says "Dein Programm hat sehr viel ausgegeben und wurde gestoppt (Endlosschleife?)."
- Uncaught exceptions are shown with the line number in the student's file. Clicking it jumps to the line.

### 3.3 Hidden `main()` (optional per exercise)
- Java 25 compact source files (`void main()`) are the default.
- An exercise can provide a hidden harness, e.g. a `main()` that calls `summe(...)`. The student's file then contains only the method(s) to fill.
- Implementation: implicit classes cannot be referenced from other files. So the harness is **appended to the end** of the student's file in a temp build directory before compiling. Line numbers of the student's code stay unchanged. Errors inside the harness are reported as "Fehler im vorgegebenen Code" (the exercise is broken, not the student's code).
- If no harness is set, the student writes `main()` themselves.

### 3.4 Tests ("Testen")
Two test types, both defined by the teacher in `tests.yaml`:

```yaml
tests:
  - name: "3 + 4"
    type: io              # feeds stdin, compares stdout
    input: "3\n4\n"
    expected: "7"
    match: contains       # exact | contains | trimmed | lines (default: trimmed, whitespace-normalized)
    timeout: 2s
  - name: "summe(-2, 5)"
    type: check           # Java expression compared to an expected value
    call: "summe(-2, 5)"
    expected: "3"
  - name: "Person speichert Namen"
    type: check
    code: |               # free-form block that returns boolean
      var p = new Person("Anna");
      return p.getName().equals("Anna");
```

- `call` results are compared as text with `expected`: `String.valueOf(result)`, arrays as `[1, 2, 3]`. Floating-point values must match exactly; for a tolerance use a `code` block.
- Prefer `check` tests for methods; use `io` only when the output itself is what is being tested. For programs with prompts or debug output use `lines` or `contains`.
- `io` match modes: `exact` (only line endings normalised), `trimmed` (default; whitespace-normalized, whole output must be equal), `contains` (expected is a substring of the output), `lines`.
- `lines`: output and expected are normalised like `trimmed`; then every non-empty expected line must equal a whole output line, in order. Other output lines (prompts, debug output, blank lines) are ignored. An empty `expected` (or only whitespace) is rejected for `contains` and `lines`, since it would match any output; `exact` and `trimmed` accept it and then mean "prints nothing".
- Decimal rule (`trimmed`, `contains`, `lines`; not `exact`): a comma or dot between two digits counts as the same, so `3,14` matches `3.14`. Reason: `printf("%.2f", x)` prints `3,14` on a German-locale JVM, while teachers write `3.14`. A comma or dot not between two digits (`[1, 2]`, `a,b`) is unchanged.
- `check` tests are compiled into the same compilation unit (appended like the harness) and started by a generated entry point. Students call their methods directly, without JUnit or reflection in the test code.
- Each test has a timeout (default 2 s). A timeout shows as "Dein Programm hat zu lange gebraucht (Endlosschleife?)".
- Result per test: passed / failed (expected vs. actual) / error (exception, timeout, compile error).
- Summary:
  - all passed → **"Dein Code sieht richtig aus!"**
  - otherwise → **"Da sind noch Fehler in deinem Programm."**
- Tests are not secret: students run them locally and could read them. They are feedback, not grading.

### 3.5 Hand-in ("Abgeben")
- If the last test run failed, tests were not run yet, or the code changed since the last run: confirmation dialog "Da sind noch Fehler in deinem Programm. Möchtest du wirklich abgeben?" Exercises without tests never ask.
- Multiple hand-ins are allowed; the last one counts.
- **Online mode**: uploads editable files plus the test summary. The server stores a server-side timestamp. Hand-ins after the deadline are accepted and marked "verspätet".
- **Exam mode**: copies files to `<handInPath>\<Aufgabe>\` and writes `abgabe.json` (name, timestamp, test summary). Autosave goes to `<handInPath>\<Aufgabe>\_autosave\`. On opening an exercise (after a crash or on another exam PC) the newer of autosave and hand-in is restored. No lockdown: closing the app asks only if the code changed since the last hand-in. `<Aufgabe>` is the exercise id.

### 3.6 Student onboarding (online mode)
- The teacher issues every student's token: the **personal code is the token**. No other credential is derived from it.
- First start: the student enters the personal code. The app checks it once (`POST /api/student/login`) and stores it locally. Afterwards it sends it as `Authorization: Bearer <code>` with every request.
- The same code works on several laptops at once. On a new laptop the last hand-in per exercise is restored as the starting point. Drafts are local only.
- "Code zurücksetzen" replaces the code with a new one. The old code stops working immediately; the student needs the new slip. Hand-ins stay.
- Codes: 8 characters from an unambiguous alphabet (no 0/O, 1/I/L), shown as `XXXX-XXXX`, case-insensitive. They are stored readable (needed for the code sheet). Login and all student routes are rate-limited per IP, which makes guessing impractical.

### 3.7 Teacher view (web, minimal)
- Teacher login as in parsonxam: passwordless sign-in link by email (single use, valid 15 min) → 30-day session token, stored hashed, sent as `Bearer`. Rate-limited. One teacher account in v1; more can be added in the database.
- Courses: create, archive.
- Students: paste a list of names → personal codes generated → printable code sheet. Reset code.
- Exercises: upload as zip (exercise folder, see §4). Unlock or hide per course. Optional soft deadline per course.
- Hand-ins: matrix of students × exercises with last hand-in timestamp, late marker and test summary. Filter "only missing hand-ins". Clicking a cell opens the hand-in: code (read-only, highlighted), test summary (passed/total), history of all hand-ins of that student, previous/next student. Download all hand-ins of one exercise as zip, one folder per student.
- Students list shows code, last activity ("noch nie angemeldet" highlighted) and hand-in count. Printable code sheet: A4 cut-out slips with name, class and code.
- Designs: Figma file "jide – Screens" (https://www.figma.com/design/QiOYkq1KgnmpzIjeYYBCGL), pages "Schüler-App" and "Lehrer-Web".
- Exam mode needs no export: the teacher copies exercise folders (§4) into `exercises/` by hand.

## 4. Exercise format

One folder per exercise. The same format is used for upload, online download and exam mode.

```
summe/
  exercise.yaml
  aufgabe.md          # rendered in the app
  files/
    Summe.java        # starter code shown to the student
  harness/
    Summe.main.java   # optional, appended to files/Summe.java
  tests.yaml          # optional
  resources/          # optional input files (e.g. for file operations), copied to the working directory
```

```yaml
# exercise.yaml
id: summe
title: "Summe zweier Zahlen"
files:
  - path: Summe.java
    editable: true
  - path: Person.java
    editable: false
harness:
  appendTo: Summe.java
  file: harness/Summe.main.java
mainFile: Summe.java   # file that is launched
images:                # optional, read-only SVG diagrams in files/, viewed in the middle area
  - path: klassendiagramm.svg
    title: Klassendiagramm   # optional label in the file list
```

Working directory for running and testing: a temp copy of the exercise with `resources/` in it.

## 5. Architecture and tech stack

```
┌──────────── Electron app (TypeScript) ────────────┐        ┌──── Uberspace ───────────────┐
│ Renderer: Monaco, file tree, console, test panel  │  HTTPS │ backend/: Hono + TypeScript   │
│ Main: exercise store, mode switch, hand-in        │◄──────►│   REST API, zod validation    │
│ Java helper process (long-running):               │  JSON  │   MariaDB                     │
│   javax.tools compile → diagnostics               │        │   file storage for hand-ins   │
│   launches java for run/test                      │        │ teacher/: SvelteKit SPA       │
└───────────────────────────────────────────────────┘        └───────────────────────────────┘
```

The backend and teacher app follow **parsonxam** (`~/git/Personal/_work/parsonxam`): same stack, same auth code (sign-in links, hashed session tokens, `Bearer` middleware, rate limiter, mailer), same migration and deployment pattern. Copy from there rather than reinventing.

- **Electron + TypeScript + Svelte 5** (renderer), Monaco editor, xterm.js console (plain pipes, no native modules).
- **Java helper**: a Maven project (Java 25, JUnit 5 tests, packaged as one runnable jar). A small Java program that stays running and compiles via `javax.tools.JavaCompiler` in memory. This avoids ~1 s JVM startup per keystroke pause. Programs are run in a separate `java` process so they can be killed.
- **JDK**: online mode bundles a jlink'd Temurin JDK 25 (including `jdk.compiler`). Exam mode uses the installed JDK: `jdkPath` from `exam.json` → `JAVA_HOME` → `PATH`. It shows a clear error if no JDK 25 is found.
- **Backend**: Hono + TypeScript + MariaDB on Uberspace (Germany), as in parsonxam. No student code is ever executed on the server.
- **Teacher app**: SvelteKit SPA, as in parsonxam's `teacher/`.
- **Shared package**: exercise format types, test-format parser and API types, used by app and backend.

### Backend API (sketch)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/student/login` | check a personal code, return name and course (the code itself is the token) |
| POST | `/api/teacher/auth/request-link` | send a sign-in link (parsonxam) |
| POST | `/api/teacher/auth/verify` | sign-in link → session token (parsonxam) |
| GET | `/api/exercises` | unlocked exercises for the student's course |
| GET | `/api/exercises/:id` | exercise package (zip) |
| POST | `/api/exercises/:id/handins` | upload hand-in (files + test summary) |
| GET | `/api/exercises/:id/handins/latest` | restore on a new laptop |

## 6. Project structure

```
jide/
  app/          Electron app
  java-helper/  Java compile/run helper
  backend/      Hono API + MariaDB
  teacher/      SvelteKit teacher app
  shared/       types, exercise format, test format
  examples/     sample exercises (also used as test fixtures)
```

## Workflow

As in parsonxam: trunk-based, one short-lived branch per task from `TASKS.md`, atomic commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), merged into `main` when tests and typecheck pass.

## 7. Testing strategy
- Unit tests for the exercise/test-format parser, harness merging (line numbers!), output comparison and the deadline/late logic.
- Integration tests for the Java helper: compile errors, run with stdin, timeout, harness, check tests. Uses the sample exercises in `examples/`.
- API tests for the backend.
- Manual smoke test on a Windows laptop and, before January, a dry run of exam mode from a network share.

## 8. Milestones

First exam: **2026-11-19**. The switch to the app follows right after. That leaves ~3 weeks from today (2026-10-30), so the order puts the things needed in class first.

| Milestone | Content | Target |
|---|---|---|
| M1 – Local IDE | Editor, highlighting, auto-compile, completion (A), run with console, harness, exercise folder loaded locally | 2026-11-08 |
| M2 – Backend + online mode | Personal codes, exercise download, hand-in, minimal teacher view, installer + auto-update | **2026-11-19** |
| M3 – Tests | `tests.yaml`, test panel, messages, confirmation on hand-in | 2026-11-29 (can slip without blocking the switch) |
| M4 – Exam mode | `exam.json`, local exercises, hand-in to P:, autosave, run from share | **before the 2nd exam (January)**, dry run in December |
| Phase 2 | Debugger (breakpoints, stepping, variables) | later |

## 9. Boundaries

- **Always**: German UI texts; server-side timestamps for hand-ins; student code runs only on the student's machine.
- **Ask first**: new dependencies with native modules; changes to the exercise format once exercises exist.
- **Never**: execute student code on the server; store more personal data than names and course membership.

**Non-goals (v1)**: debugger, real code analysis for completion, macOS/Linux builds, code signing, teacher account management UI, server-side grading, plagiarism detection.

## 10. Risks
1. **Running from a network share** (exam mode): Electron's unpacked folder is ~200 MB of files, and 16 students start it at once from SMB. Startup may be slow. Windows may warn about executables from network locations. → Test early on the real Angabelaufwerk.
2. **Read-only Angabelaufwerk**: the app must never write next to the exe. Electron's user-data and cache directories go to `%TEMP%`; everything the student produces goes to the hand-in drive.
3. **Unsigned app**: SmartScreen warning on first install. → One-time walkthrough in class.
4. **Antivirus** scanning every compiled `.class` file may slow down auto-compile. → In-memory compilation, write class files only for run/test.

## 11. Decided points
- First exam 2026-11-19; first lesson with the app (install walkthrough) 2026-11-20.
- Exam PCs have `JAVA_HOME` set to a JDK 25.
- The Angabelaufwerk is mapped to a drive letter and read-only for students.
- Exercise updates after publishing: the student's files are kept, only tests/harness/assignment text are updated.
