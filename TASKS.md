# M1 – Local IDE (target 2026-11-08)

Each task ends with something that runs. See SPEC.md for details and the Figma file for the screens.
Implementation is done by Sonnet subagents; planning, review and debugging stay in the main (Opus) session.

- [ ] **T1 Scaffold** – npm workspaces (`app`, `shared`), Electron + electron-vite + TypeScript, Monaco in an empty window.
  - Done when: `npm run dev` opens a window with a Java-highlighted editor; `npm run build` and `npm test` pass.
- [ ] **T2 Exercise loader** (`shared`) – parse `exercise.yaml`, copy the exercise into a local workspace on first open, never overwrite student files on update.
  - Done when: unit tests for parsing, the first copy and the update rule pass, using `examples/summe`.
- [ ] **T3 Java helper** (`java-helper`) – long-running process, JSON over stdin/stdout. `compile` (in memory, `--release 25`, German messages) returns diagnostics; harness appended to the target file.
  - Done when: integration tests pass: a syntax error is reported in the right line, the harness compiles, and an error inside the harness is flagged as such.
- [ ] **T4 Editor UI** – file tree, tabs, read-only files, rendered assignment panel (Markdown → sanitized HTML), local autosave.
  - Done when: `examples/summe` opens and edits survive an app restart.
- [ ] **T5 Live errors** – compile 500 ms after typing stops → Monaco markers + "Probleme" list.
  - Done when: a missing `;` shows a red squiggle within ~1 s.
- [ ] **T6 Run + console** – compile to a temp dir, start `java`, xterm.js console with stdin, Stopp button, 1 MB output cap, clickable exception lines.
  - Done when: a Scanner program reads two numbers and prints the sum; an endless loop can be stopped.
- [ ] **T7 Completion** – keywords/snippets, curated class catalogue (IO, String, Math, Scanner, Random, …), identifiers in the file, `sc.` member heuristic.
  - Done when: typing `Math.` lists `max`, `abs`, `sqrt`… with German descriptions.

Windows packaging (installer + bundled JDK) moves to M2, so it's ready for 2026-11-20.
