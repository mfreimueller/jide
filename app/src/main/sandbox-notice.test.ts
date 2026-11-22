import { describe, expect, it } from "vitest";
import { NO_SANDBOX_NOTICE, shouldWarnNoSandbox } from "./sandbox-notice";

const base = { platform: "linux", appImage: "/home/s/Applications/JDE.AppImage", noSandboxSwitch: true, suppressed: false };

describe("shouldWarnNoSandbox", () => {
  it("warns on a Linux AppImage with --no-sandbox", () => {
    expect(shouldWarnNoSandbox(base)).toBe(true);
  });
  it("stays quiet with the sandbox on", () => {
    expect(shouldWarnNoSandbox({ ...base, noSandboxSwitch: false })).toBe(false);
  });
  it("stays quiet outside a Linux AppImage", () => {
    expect(shouldWarnNoSandbox({ ...base, appImage: undefined })).toBe(false);
    expect(shouldWarnNoSandbox({ ...base, appImage: "" })).toBe(false);
    expect(shouldWarnNoSandbox({ ...base, platform: "win32" })).toBe(false);
    expect(shouldWarnNoSandbox({ ...base, platform: "darwin" })).toBe(false);
  });
  it("stays quiet in tests, smoke runs and exam mode", () => {
    expect(shouldWarnNoSandbox({ ...base, suppressed: true })).toBe(false);
  });
  it("has the agreed text", () => {
    expect(NO_SANDBOX_NOTICE).toEqual({
      kind: "info",
      text: "J;DE läuft ohne Sandbox. Eine einmalige Einrichtung behebt das: Handbuch → Die App für Schüler:innen → Linux."
    });
  });
});
