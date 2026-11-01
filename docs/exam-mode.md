# Exam folder (exam mode)

Exam mode is the same app as online mode, switched on by an `exam.json` next to `JDE.exe` (SPEC section 2). It is started from the school's read-only network share (Angabelaufwerk), needs no installation, never talks to the network and never updates itself. This page covers getting the folder onto the share, the start screen, the workspace, hand-in to `P:` and autosave.

## What the zip contains

Every release attaches `JDE-Exam-<version>.zip` next to the installer (GitHub Releases); the manual workflow "Exam build" produces the same zip as a workflow artifact without releasing. Replace the sample `exam.json` and `exercises\` before an exam.

`JDE-Exam-<version>.zip` holds one folder `JDE-Exam`:

- `JDE.exe` and the other files of the unpacked Electron app (no installer, no bundled JDK, no auto-update),
- `resources\java-helper.jar` (compile/run/test helper),
- `exam.json` (sample: `mode`, `title`, `handInPath`, `jdkPath`, `allowTests`; validated at start, a broken file shows an error screen),
- `exercises\summe` and `exercises\maximum` (the sample exercises, same folder format as for upload).

Everything the app writes (settings, workspaces, caches, logs) goes to `%TEMP%\JDE-exam` on the PC. Nothing is ever written into the folder on the share.

## Start screen and workspace

After `exam.json` and the JDK are ok, the student sees the start screen: the exam title, the hand-in drive, a field "Vor- und Nachname" and "Prüfung starten" (disabled until the trimmed name is not empty; Enter also starts). The footer shows the number of exercises and whether testing is allowed. The name is asked at every start and is not stored; the main process keeps it (it goes into `abgabe.json`).

The workspace has no exercise list. Every exercise in `exercises\` is a tab button "Aufgabe 1", "Aufgabe 2", ... at the left of the top bar, the dark bar shows `PRÜFUNG` and the student's name, and the assignment heading reads "Aufgabe <n>: <title>" (the leading `# ...` line of `aufgabe.md` is replaced by it). Each exercise keeps its own open files, edits and last test result while the student switches tabs; the current exercise is saved before switching.

**Order of the tabs = exercises sorted by exercise id** (`id` in `exercise.yaml`, which is also the folder name used for the hand-in). To fix the order, prefix the ids: `1-summe`, `2-maximum`, ... An exercise whose folder is broken is not a tab; the German loading error is shown on the start screen.

`allowTests: false` in `exam.json`: no "Testen" button and no "Tests" tab, the start screen says "Testen ist nicht erlaubt", and the main process refuses a test run ("Testen ist in dieser Prüfung nicht erlaubt.").

## Get the zip

GitHub -> Actions -> "Exam build" -> "Run workflow" -> wait for the green run -> open it -> download the artifact `JDE-Exam` (a zip that contains `JDE-Exam-<version>.zip`). The run log prints the start-up time from a read-only local folder, the zip size and the file count.

## Put it on the Angabelaufwerk

Unzip `JDE-Exam-<version>.zip` and copy the folder `JDE-Exam` to the share (for a test: a folder the students can read but not write). To change the exercises, put exercise folders into `exercises\` (same format as for upload, SPEC section 4) and edit `exam.json`.

The exam PCs need a JDK 25 or newer (with javac): found via `jdkPath` in `exam.json`, then `JAVA_HOME`, then `java` on the `PATH`; otherwise an error screen lists what was searched. The folder bundles no JDK.

## What to test and report (T22)

Start `JDE.exe` from the share on an exam PC and report:

1. Start-up time until the exercise list is visible: first start and second start; ideally with several PCs starting at the same time (e.g. 8 or more).
2. Any Windows warning: SmartScreen, "Open File - Security Warning", antivirus prompts, firewall prompts. Which text, which PC.
3. Does an exercise open ("Öffnen")?
4. Compile: type an error, a red squiggle must appear and "Probleme" must list it.
5. Run ("Ausführen"): output appears in the console.
6. Test ("Testen"): the test panel shows results. This needs `JAVA_HOME` = JDK 25 on the exam PC; if Java is missing, say what the app shows.
7. Check that nothing got written to the share (no new files or folders in `JDE-Exam`, modification times unchanged).

The "Exam build" workflow already checks on a GitHub Windows runner that the app starts from a folder with write access denied, that the folder is unchanged afterwards and, where the runner allows it, that it starts from a `\\localhost\C$\...` path. That does not replace the test on the real share.

## Known issue: starting from a network path

On a GitHub Windows runner the app starts from a local read-only folder (about 1 s), but not from a mapped drive or a `\\<computer>\...` path through the loopback admin share: Chromium cannot launch its sandboxed GPU process from a network location ("GPU process isn't usable") and exits. The same runs succeed with the switch `--no-sandbox` (with or without `--disable-gpu`); `--disable-gpu` alone does not help. Whether the real Angabelaufwerk behaves the same is exactly what the share test has to show. If it does, exam mode needs a decision (open, see TASKS.md T22). Also note that `\\localhost\C$\...` is unusable for a different reason (Node turns `file://localhost/...` into a path without host and the app dies with a JavaScript error); test with the real server name or a drive letter.

To try the switch by hand on an exam PC: `JDE.exe --no-sandbox` from a command prompt, and report whether it then starts.
