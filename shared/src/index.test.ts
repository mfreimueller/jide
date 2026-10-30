import { describe, expect, it } from "vitest";
import { JIDE_SHARED_VERSION } from "./index";

describe("shared", () => {
  it("exports a version", () => {
    expect(JIDE_SHARED_VERSION).toBe("0.1.0");
  });
});
