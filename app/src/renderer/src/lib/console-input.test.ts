import { describe, expect, it } from "vitest";
import { INPUT_COLOR, RESET, processInput } from "./console-input";

describe("processInput", () => {
  it("echoes typed characters in green and keeps the line", () => {
    const r = processInput("", "3");
    expect(r).toEqual({ buffer: "3", echo: INPUT_COLOR + "3" + RESET, lines: [] });
  });

  it("sends the line with a newline on Enter", () => {
    const r = processInput("34", "\r");
    expect(r.lines).toEqual(["34\n"]);
    expect(r.buffer).toBe("");
    expect(r.echo).toBe("\r\n");
  });

  it("Backspace removes the last character and only that", () => {
    const r = processInput("ab", "\x7f");
    expect(r.buffer).toBe("a");
    expect(r.echo).toBe("\b \b");
    expect(processInput("", "\x7f")).toEqual({ buffer: "", echo: "", lines: [] });
  });

  it("handles umlauts and pasted text with several lines", () => {
    const r = processInput("", "Grüße\r4\r");
    expect(r.lines).toEqual(["Grüße\n", "4\n"]);
    expect(r.buffer).toBe("");
  });

  it("ignores escape sequences and control characters", () => {
    expect(processInput("a", "\x1b[A")).toEqual({ buffer: "a", echo: "", lines: [] });
    expect(processInput("a", "\x03")).toEqual({ buffer: "a", echo: "", lines: [] });
  });
});
