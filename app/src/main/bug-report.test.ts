import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: {}, BrowserWindow: {}, clipboard: {}, dialog: {}, ipcMain: {} }));
vi.mock("./context", () => ({ context: () => ({}) }));
vi.mock("./exam-state", () => ({ examSession: () => undefined }));

import { describeOs, reportFileName } from "./bug-report";

describe("describeOs", () => {
  it("tells Windows 11 from Windows 10 by the build number", () => {
    expect(describeOs("win32", "10.0.22631")).toBe("Windows 11 (10.0.22631)");
    expect(describeOs("win32", "10.0.19045")).toBe("Windows 10 (10.0.19045)");
  });
  it("names other systems", () => {
    expect(describeOs("darwin", "25.6.0")).toBe("macOS (Darwin) 25.6.0");
    expect(describeOs("linux", "6.1.0")).toBe("Linux 6.1.0");
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
