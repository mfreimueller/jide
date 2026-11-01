# Releasing J;DE

Releases are built by `.github/workflows/release.yml` on `windows-latest` and published to GitHub Releases. Installed apps pick them up through electron-updater: they check at start, download in the background and install when the student quits the app. Nothing is shown to the student.

## One-time setup: backend URL

The app talks to the backend at a URL that is fixed at build time. Set the repository variable `JIDE_API_URL` (Settings -> Secrets and variables -> Actions -> Variables), e.g. `https://jide.example.org` (no trailing path, the app appends `/api/...`). The release workflow, and with it the installer job of CI, fails right away if the variable is empty. An unpackaged app (dev, e2e) may override it at runtime with the environment variable `JIDE_API_URL`; the installed app never does. Without any value a dev build uses `http://localhost:3000`.

## Cut a release

1. Set the new version in `app/package.json` (`"version": "X.Y.Z"`), commit and push to `main` once CI is green.
2. Tag exactly that version and push the tag:
   ```
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. The workflow fails right away if the tag does not match `app/package.json`. Otherwise it builds the java-helper jar, jlinks the bundled JDK (`java.base`, `jdk.compiler`, `jdk.localedata`), builds `JDE-Setup-X.Y.Z.exe`, installs it silently, starts the installed app with `JIDE_SMOKE=1` (must print `JIDE_SMOKE_READY`) and only then publishes the release (not a draft, so electron-updater sees it).
4. Check the release page: `JDE-Setup-X.Y.Z.exe`, its `.blockmap`, `latest.yml` and the exam folder `JDE-Exam-X.Y.Z.zip` (built by `exam-build.yml`, see [exam-mode.md](exam-mode.md)) must be attached.

## Dry run (no publishing)

Actions -> Release -> "Run workflow" with "dry run" ticked (the default) builds, installs and smoke-tests without publishing. Only a `v*` tag, or a manual run with the box unticked, publishes.

## Notes

- The app is unsigned: Windows SmartScreen warns on first install ("More info" -> "Run anyway").
- The installer is per-user (no admin) and installs to `%LOCALAPPDATA%\Programs\JDE`; shortcuts are named "J;DE".
- The installed app is online-only: it starts with the login screen and ships no exercises. `JIDE_EXERCISES_DIR` (local folder, no login) exists for dev and e2e only.
- Auto-update runs only in the installed app, never in dev or e2e.
- Locally: `npm run runtime -w app` (needs `JAVA_HOME` = JDK 25) builds the bundled JDK, `npm run verify-runtime -w app` checks German javac messages and number formatting, `npm run dist -w app` builds the installer (on Windows).
- The exam folder (`JDE-Exam-<version>.zip`, unpacked app without JDK) is built by the separate workflow `exam-build.yml` (manual run, artifact only, no release); see [exam-mode.md](exam-mode.md). The installer build is not affected.
