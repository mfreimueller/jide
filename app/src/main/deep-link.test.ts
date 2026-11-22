import { describe, expect, it } from "vitest";
import {
  findDeepLinkInArgv,
  isAllowedPracticeSrc,
  MSG_NO_SRC,
  MSG_UNKNOWN_LINK,
  parseDeepLink,
  practiceInsecure
} from "./deep-link";

const HOST = "die-spengergasse.github.io";
const HOSTS = [HOST, "kurs.example.org"];
const ZIP = `https://${HOST}/practice/schleifen.zip`;
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
  const ok = (src: string, hosts: readonly string[] = HOSTS, insecure = false): boolean => isAllowedPracticeSrc(src, hosts, insecure);
  it("allows https zips on a listed host, any path", () => {
    expect(ok(ZIP)).toBe(true);
    expect(ok(`https://${HOST}/x.zip`)).toBe(true);
    expect(ok(`https://${HOST}/a/b/c/x.zip`)).toBe(true);
    expect(ok("https://kurs.example.org/y.zip")).toBe(true);
    expect(ok(`https://${HOST}:443/a.zip`)).toBe(true); // default port
    expect(ok(`https://${HOST}/a.zip?v=2#x`)).toBe(true);
  });
  it("matches the host case-insensitively", () => {
    expect(ok("https://Die-Spengergasse.GitHub.io/a.ZIP")).toBe(true);
    expect(ok(ZIP, ["DIE-SPENGERGASSE.github.io"])).toBe(true);
  });
  it("needs the exact host: no subdomains, parents or lookalikes", () => {
    for (const bad of [
      `https://sub.${HOST}/a.zip`,
      `https://${HOST}.evil.com/a.zip`,
      "https://github.io/a.zip",
      `https://x${HOST}/a.zip`,
      `https://${HOST}./a.zip`,
      `https://evil.com/?x=https://${HOST}/a.zip`,
      `https://evil.com/${HOST}/a.zip`,
      `https://${HOST}@evil.com/a.zip`,
      "https://example.com/x.zip"
    ]) {
      expect(ok(bad), bad).toBe(false);
    }
  });
  it("rejects everything with an empty host list", () => {
    expect(ok(ZIP, [])).toBe(false);
  });
  it("rejects other schemes", () => {
    for (const bad of [`http://${HOST}/a.zip`, `ftp://${HOST}/a.zip`, `file:///${HOST}/a.zip`, `//${HOST}/a.zip`]) {
      expect(ok(bad), bad).toBe(false);
    }
  });
  it("rejects an explicit port and credentials", () => {
    for (const bad of [`https://${HOST}:8443/a.zip`, `https://user@${HOST}/a.zip`, `https://user:pw@${HOST}/a.zip`]) {
      expect(ok(bad), bad).toBe(false);
    }
  });
  it("requires a .zip path with a file name", () => {
    for (const p of ["/", "", "/a.zip.html", "/a?f=b.zip", "/.zip", "/dir/.zip", "/a.zip/", "/zip", "/a.txt"]) {
      expect(ok(`https://${HOST}${p}`), p).toBe(false);
    }
  });
  it("rejects encoded separators and backslashes in the path", () => {
    for (const p of ["/a%2fb.zip", "/a%2Fb.zip", "/a%5cb.zip", "/a%5Cb.zip", "/%2e%2e%2fx.zip"]) {
      expect(ok(`https://${HOST}${p}`), p).toBe(false);
    }
    // a literal backslash is turned into a separator by the URL parser: the checked path is the requested one
    expect(new URL(`https://${HOST}/a\\b.zip`).pathname).toBe("/a/b.zip");
  });
  it("dot segments are normalized by the URL parser", () => {
    expect(ok(`https://${HOST}/a/../x.zip`)).toBe(true);
    expect(ok(`https://${HOST}/a/%2e%2e/x.zip`)).toBe(true);
    expect(ok(`https://${HOST}/a/..`)).toBe(false);
  });
  it("rejects garbage", () => {
    expect(ok("")).toBe(false);
    expect(ok("not a url")).toBe(false);
  });
  it("insecure (tests only) also allows http and an explicit port, but not other hosts", () => {
    const hosts = ["127.0.0.1"];
    expect(ok("http://127.0.0.1:5000/kurs/a.zip", hosts, true)).toBe(true);
    expect(ok("http://127.0.0.1:5000/kurs/a.zip", hosts, false)).toBe(false);
    expect(ok("http://127.0.0.1:5000/a.txt", hosts, true)).toBe(false);
    expect(ok("http://localhost:5000/a.zip", hosts, true)).toBe(false);
    expect(ok("http://u@127.0.0.1:5000/a.zip", hosts, true)).toBe(false);
    expect(ok("ftp://127.0.0.1/a.zip", hosts, true)).toBe(false);
  });
});

describe("practiceInsecure (test override)", () => {
  it("is on only with the user data folder override and JIDE_TEST_PRACTICE_INSECURE=1", () => {
    expect(practiceInsecure({})).toBe(false);
    expect(practiceInsecure({ JIDE_TEST_PRACTICE_INSECURE: "1" })).toBe(false);
    expect(practiceInsecure({ JIDE_USER_DATA_DIR: "/tmp/x" })).toBe(false);
    expect(practiceInsecure({ JIDE_USER_DATA_DIR: "/tmp/x", JIDE_TEST_PRACTICE_INSECURE: "0" })).toBe(false);
    expect(practiceInsecure({ JIDE_USER_DATA_DIR: "/tmp/x", JIDE_TEST_PRACTICE_INSECURE: "1" })).toBe(true);
  });
});
