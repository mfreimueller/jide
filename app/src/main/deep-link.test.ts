import { describe, expect, it } from "vitest";
import {
  findDeepLinkInArgv,
  isAllowedPracticeSrc,
  MSG_NO_SRC,
  MSG_UNKNOWN_LINK,
  parseDeepLink,
  PRACTICE_ORIGIN
} from "./deep-link";

const ZIP = `${PRACTICE_ORIGIN}practice/schleifen.zip`;
const enc = encodeURIComponent;
const unknown = { kind: "error", message: MSG_UNKNOWN_LINK };
const noSrc = { kind: "error", message: MSG_NO_SRC };

describe("findDeepLinkInArgv", () => {
  it("finds the first jide:// argument, case-insensitive", () => {
    expect(findDeepLinkInArgv(["app.exe", "--flag", "jide://practice?src=x", "jide://other"])).toBe("jide://practice?src=x");
    expect(findDeepLinkInArgv(["app", "JIDE://practice"])).toBe("JIDE://practice");
  });
  it("returns undefined without a link", () => {
    expect(findDeepLinkInArgv([])).toBeUndefined();
    expect(findDeepLinkInArgv(["app", "https://x", "xjide://a"])).toBeUndefined();
  });
});

describe("parseDeepLink", () => {
  it("accepts jide://practice?src=…", () => {
    expect(parseDeepLink(`jide://practice?src=${enc(ZIP)}`)).toEqual({ kind: "practice", src: ZIP });
  });
  it("accepts the trailing-slash form and a plain src", () => {
    expect(parseDeepLink(`jide://practice/?src=${enc(ZIP)}`)).toEqual({ kind: "practice", src: ZIP });
    expect(parseDeepLink(`jide://practice?src=${ZIP}`)).toEqual({ kind: "practice", src: ZIP });
  });
  it("is case-insensitive for scheme and action", () => {
    expect(parseDeepLink(`JIDE://Practice?src=${enc(ZIP)}`)).toEqual({ kind: "practice", src: ZIP });
  });
  it("ignores additional unrelated params and the fragment", () => {
    expect(parseDeepLink(`jide://practice?a=1&src=${enc(ZIP)}#x`)).toEqual({ kind: "practice", src: ZIP });
  });
  it("rejects unknown actions", () => {
    expect(parseDeepLink("jide://foo")).toEqual(unknown);
    expect(parseDeepLink(`jide://foo?src=${enc(ZIP)}`)).toEqual(unknown);
    expect(parseDeepLink(`jide://practice/extra?src=${enc(ZIP)}`)).toEqual(unknown);
    expect(parseDeepLink(`jide:practice?src=${enc(ZIP)}`)).toEqual(unknown);
    expect(parseDeepLink(`jide://user@practice?src=${enc(ZIP)}`)).toEqual(unknown);
  });
  it("rejects other schemes and garbage", () => {
    expect(parseDeepLink(`https://practice?src=${enc(ZIP)}`)).toEqual(unknown);
    expect(parseDeepLink("")).toEqual(unknown);
    expect(parseDeepLink("not a url")).toEqual(unknown);
    expect(parseDeepLink("jide://")).toEqual(unknown);
  });
  it("rejects a missing, empty or repeated src", () => {
    expect(parseDeepLink("jide://practice")).toEqual(noSrc);
    expect(parseDeepLink("jide://practice?")).toEqual(noSrc);
    expect(parseDeepLink("jide://practice?src=")).toEqual(noSrc);
    expect(parseDeepLink("jide://practice?src=%20")).toEqual(noSrc);
    expect(parseDeepLink("jide://practice?other=1")).toEqual(noSrc);
    expect(parseDeepLink(`jide://practice?src=${enc(ZIP)}&src=${enc(ZIP)}`)).toEqual(noSrc);
  });
  it("passes any src through; the origin is checked separately", () => {
    expect(parseDeepLink(`jide://practice?src=${enc("https://example.com/x.zip")}`)).toEqual({
      kind: "practice",
      src: "https://example.com/x.zip"
    });
  });
});

describe("isAllowedPracticeSrc", () => {
  it("allows zips on the course origin", () => {
    expect(isAllowedPracticeSrc(ZIP)).toBe(true);
    expect(isAllowedPracticeSrc("https://sj2627-pos-lernwerkstatt.github.io/a/b/c.zip")).toBe(true);
    expect(isAllowedPracticeSrc("https://sj2627-pos-lernwerkstatt.github.io:443/a.zip")).toBe(true); // default port
    expect(isAllowedPracticeSrc("https://SJ2627-POS-Lernwerkstatt.github.io/a.ZIP")).toBe(true);
  });
  it("rejects lookalike hosts", () => {
    for (const bad of [
      "https://sj2627-pos-lernwerkstatt.github.io.evil.com/a.zip",
      "https://evil.com/?x=https://sj2627-pos-lernwerkstatt.github.io/a.zip",
      "https://evil.com/sj2627-pos-lernwerkstatt.github.io/a.zip",
      "https://xsj2627-pos-lernwerkstatt.github.io/a.zip",
      "https://sj2627-pos-lernwerkstatt.github.io./a.zip",
      "https://github.io/a.zip",
      "https://example.com/x.zip"
    ]) {
      expect(isAllowedPracticeSrc(bad), bad).toBe(false);
    }
  });
  it("rejects other schemes, credentials and ports", () => {
    for (const bad of [
      "http://sj2627-pos-lernwerkstatt.github.io/a.zip",
      "ftp://sj2627-pos-lernwerkstatt.github.io/a.zip",
      "file:///sj2627-pos-lernwerkstatt.github.io/a.zip",
      "https://user@sj2627-pos-lernwerkstatt.github.io/a.zip",
      "https://user:pw@sj2627-pos-lernwerkstatt.github.io/a.zip",
      "https://sj2627-pos-lernwerkstatt.github.io@evil.com/a.zip",
      "https://sj2627-pos-lernwerkstatt.github.io:8443/a.zip",
      "//sj2627-pos-lernwerkstatt.github.io/a.zip"
    ]) {
      expect(isAllowedPracticeSrc(bad), bad).toBe(false);
    }
  });
  it("requires a .zip path", () => {
    expect(isAllowedPracticeSrc("https://sj2627-pos-lernwerkstatt.github.io/")).toBe(false);
    expect(isAllowedPracticeSrc("https://sj2627-pos-lernwerkstatt.github.io/a.zip.html")).toBe(false);
    expect(isAllowedPracticeSrc("https://sj2627-pos-lernwerkstatt.github.io/a?f=b.zip")).toBe(false);
  });
  it("rejects garbage", () => {
    expect(isAllowedPracticeSrc("")).toBe(false);
    expect(isAllowedPracticeSrc("not a url")).toBe(false);
  });
});
