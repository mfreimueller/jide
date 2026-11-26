import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] }, ipcMain: { handle: () => undefined } }));

const { EDITOR_FONT_DEFAULT, EDITOR_FONT_MAX, EDITOR_FONT_MIN, nextEditorFontSize } = await import("./editor-font");

describe("nextEditorFontSize", () => {
  it("range is 10 to 28, default 14", () => {
    expect([EDITOR_FONT_MIN, EDITOR_FONT_MAX, EDITOR_FONT_DEFAULT]).toEqual([10, 28, 14]);
  });
  it("steps by one px", () => {
    expect(nextEditorFontSize(14, "in")).toBe(15);
    expect(nextEditorFontSize(14, "out")).toBe(13);
  });
  it("reset goes back to 14 from anywhere", () => {
    expect(nextEditorFontSize(10, "reset")).toBe(14);
    expect(nextEditorFontSize(28, "reset")).toBe(14);
  });
  it("stops at 28 and 10", () => {
    expect(nextEditorFontSize(28, "in")).toBe(28);
    expect(nextEditorFontSize(27, "in")).toBe(28);
    expect(nextEditorFontSize(10, "out")).toBe(10);
    expect(nextEditorFontSize(11, "out")).toBe(10);
  });
});
