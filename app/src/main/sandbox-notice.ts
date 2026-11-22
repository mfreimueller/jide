import type { AppNotice } from "../shared-types/api";

/** Shown once per start when the AppImage runs without the Chromium sandbox (M13). */
export const NO_SANDBOX_NOTICE: AppNotice = {
  kind: "info",
  text: "J;DE läuft ohne Sandbox. Eine einmalige Einrichtung behebt das: Handbuch → Die App für Schüler:innen → Linux."
};

export interface SandboxNoticeInput {
  platform: string;
  /** `process.env.APPIMAGE` (set only inside a running AppImage). */
  appImage: string | undefined;
  /** `app.commandLine.hasSwitch("no-sandbox")`. */
  noSandboxSwitch: boolean;
  /** Tests (user data override), smoke runs and exam mode never show it. */
  suppressed: boolean;
}

/** True when the notice should be shown: Linux AppImage started with `--no-sandbox`. */
export function shouldWarnNoSandbox(i: SandboxNoticeInput): boolean {
  return !i.suppressed && i.platform === "linux" && Boolean(i.appImage) && i.noSandboxSwitch;
}
