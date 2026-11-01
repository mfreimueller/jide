# Exam folder (exam mode)

Exam mode is the same app as online mode, switched on by an `exam.json` next to `JDE.exe` (SPEC section 2). It is started from the school's read-only network share (Angabelaufwerk), needs no installation, never talks to the network and never updates itself. This page covers what exists after T22 (start from the share); name entry, hand-in to `P:` and autosave follow in T23 to T25.

## What the zip contains

`JDE-Exam-<version>.zip` holds one folder `JDE-Exam`:

- `JDE.exe` and the other files of the unpacked Electron app (no installer, no bundled JDK, no auto-update),
- `resources\java-helper.jar` (compile/run/test helper),
- `exam.json` (sample: `mode`, `title`, `handInPath`, `jdkPath`, `allowTests`; only `title` is read so far),
- `exercises\summe` and `exercises\maximum` (the sample exercises, same folder format as for upload).

Everything the app writes (settings, workspaces, caches, logs) goes to `%TEMP%\JDE-exam` on the PC. Nothing is ever written into the folder on the share.

## Get the zip

GitHub -> Actions -> "Exam build" -> "Run workflow" -> wait for the green run -> open it -> download the artifact `JDE-Exam` (a zip that contains `JDE-Exam-<version>.zip`). The run log prints the start-up time from a read-only local folder, the zip size and the file count.

## Put it on the Angabelaufwerk

Unzip `JDE-Exam-<version>.zip` and copy the folder `JDE-Exam` to the share (for a test: a folder the students can read but not write). To change the exercises, put exercise folders into `exercises\` (same format as for upload, SPEC section 4) and edit `exam.json`.

The exam PCs need JDK 25 with `JAVA_HOME` set (otherwise `java` on the `PATH` is used). The folder bundles no JDK.

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
