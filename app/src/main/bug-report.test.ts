import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: {}, BrowserWindow: {}, clipboard: {}, dialog: {}, ipcMain: {} }));
vi.mock("./context", () => ({ context: () => ({}) }));
vi.mock("./exam-state", () => ({ examSession: () => undefined }));

import { describeOs, prettyNameFromOsRelease, reportFileName } from "./bug-report";

describe("describeOs", () => {
  it("tells Windows 11 from Windows 10 by the build number", () => {
    expect(describeOs("win32", "10.0.22631")).toBe("Windows 11 (10.0.22631)");
    expect(describeOs("win32", "10.0.19045")).toBe("Windows 10 (10.0.19045)");
  });
  it("names other systems", () => {
    expect(describeOs("darwin", "25.6.0")).toBe("macOS (Darwin) 25.6.0");
  });
  it("Linux: distribution from os-release, else the kernel", () => {
    const debian = 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nID=debian\n';
    expect(describeOs("linux", "6.1.0-18-amd64", debian)).toBe("Debian GNU/Linux 12 (bookworm)");
    expect(describeOs("linux", "6.1.0", "NAME=Foo\nID=foo\n")).toBe("Linux (6.1.0)");
    expect(describeOs("linux", "6.1.0", "PRETTY_NAME=\n")).toBe("Linux (6.1.0)");
    expect(describeOs("linux", "6.1.0", null)).toBe("Linux (6.1.0)");
    expect(describeOs("linux", "6.1.0")).toBe("Linux (6.1.0)");
  });
});

describe("prettyNameFromOsRelease", () => {
  it("reads quoted, single-quoted and bare values", () => {
    expect(prettyNameFromOsRelease('PRETTY_NAME="Ubuntu 24.04.1 LTS"')).toBe("Ubuntu 24.04.1 LTS");
    expect(prettyNameFromOsRelease("PRETTY_NAME='Ubuntu 22.04 LTS'")).toBe("Ubuntu 22.04 LTS");
    expect(prettyNameFromOsRelease("ID=x\r\nPRETTY_NAME=Arch\r\n")).toBe("Arch");
  });
  it("unescapes quoted values", () => {
    expect(prettyNameFromOsRelease('PRETTY_NAME="My \\"Distro\\""')).toBe('My "Distro"');
  });
});

describe("reportFileName", () => {
  it("keeps a plain .txt name", () => {
    expect(reportFileName("jde-fehlerbericht-summe-20261119-1334.txt")).toBe("jde-fehlerbericht-summe-20261119-1334.txt");
  });
  it("strips folders and odd characters, adds .txt", () => {
    expect(reportFileName("../x/y z")).toBe("y_z.txt");
    expect(reportFileName(undefined)).toBe("jde-fehlerbericht.txt");
  });
});
