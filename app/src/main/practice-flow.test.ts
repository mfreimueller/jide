import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, OFFLINE_MESSAGE, SESSION_EXPIRED_MESSAGE } from "./api-client";
import { MSG_BAD_ORIGIN, MSG_EXAM_MODE, MSG_LOGIN_REQUIRED, MSG_NO_SRC, MSG_UNKNOWN_LINK } from "./deep-link";
import { runPracticeFlow, type PracticeFlowDeps } from "./practice-flow";
import { MSG_LOADING, MSG_OFFLINE } from "./practice-import";
import { ScratchStore } from "./scratch";

const HOST = "kurs.example.org";
const SRC = `https://${HOST}/practice/a.zip`;
const link = (src: string): string => `jide://practice?src=${encodeURIComponent(src)}`;

const goodZip = (): Buffer =>
  Buffer.from(
    zipSync({
      "exercise.yaml": strToU8("id: summe\ntitle: Summe\nfiles:\n  - path: Summe.java\nmainFile: Summe.java\n"),
      "aufgabe.md": strToU8("# Summe\n"),
      "files/Summe.java": strToU8("class Summe {}")
    })
  );

describe("runPracticeFlow", () => {
  let tmp: string;
  let store: ScratchStore;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "jide-flow-"));
    store = new ScratchStore(join(tmp, "scratch"));
  });
  afterEach(() => rm(tmp, { recursive: true, force: true }));

  const deps = (over: Partial<PracticeFlowDeps> = {}): PracticeFlowDeps => ({
    examMode: false,
    signedIn: true,
    scratch: store,
    fetchHosts: vi.fn(async () => [HOST]),
    onLoading: vi.fn(),
    download: { fetch: vi.fn(async () => new Response(new Uint8Array(goodZip()))) as unknown as typeof fetch },
    ...over
  });
  const notice = (text: string, kind: "info" | "error" = "error") => ({ kind: "notice", notice: { kind, text } });

  it("exam mode: notice, nothing else (no hosts, no download)", async () => {
    const d = deps({ examMode: true });
    expect(await runPracticeFlow(link(SRC), d)).toEqual(notice(MSG_EXAM_MODE, "info"));
    expect(d.fetchHosts).not.toHaveBeenCalled();
    expect(d.download?.fetch).not.toHaveBeenCalled();
  });

  it("parse errors come before the login check", async () => {
    const d = deps({ signedIn: false });
    expect(await runPracticeFlow("jide://foo", d)).toEqual(notice(MSG_UNKNOWN_LINK));
    expect(await runPracticeFlow("jide://practice", d)).toEqual(notice(MSG_NO_SRC));
  });

  it("not signed in: login notice, no hosts, no download, existing copy not opened", async () => {
    expect((await store.importZipBuffer(goodZip(), SRC)).ok).toBe(true);
    const d = deps({ signedIn: false });
    expect(await runPracticeFlow(link(SRC), d)).toEqual(notice(MSG_LOGIN_REQUIRED, "info"));
    expect(d.fetchHosts).not.toHaveBeenCalled();
    expect(d.download?.fetch).not.toHaveBeenCalled();
  });

  it("an existing copy opens without hosts, host check or network", async () => {
    const r = await store.importZipBuffer(goodZip(), "https://elsewhere.example/x.zip");
    if (!r.ok) throw new Error("setup");
    const d = deps({ fetchHosts: vi.fn(async () => Promise.reject(new ApiError("offline", OFFLINE_MESSAGE))) });
    expect(await runPracticeFlow(link("https://elsewhere.example/x.zip"), d)).toEqual({ kind: "open", id: r.id });
    expect(d.fetchHosts).not.toHaveBeenCalled();
    expect(d.download?.fetch).not.toHaveBeenCalled();
  });

  it("hosts fetch offline: the offline message", async () => {
    const d = deps({ fetchHosts: async () => Promise.reject(new ApiError("offline", OFFLINE_MESSAGE)) });
    expect(await runPracticeFlow(link(SRC), d)).toEqual(notice(MSG_OFFLINE));
    expect(d.download?.fetch).not.toHaveBeenCalled();
  });

  it("hosts fetch 401: the session-expired message", async () => {
    const d = deps({ fetchHosts: async () => Promise.reject(new ApiError("unauthorized", SESSION_EXPIRED_MESSAGE, 401)) });
    expect(await runPracticeFlow(link(SRC), d)).toEqual(notice(SESSION_EXPIRED_MESSAGE));
    expect(d.download?.fetch).not.toHaveBeenCalled();
  });

  it("a host that is not in the course list is refused, nothing downloaded", async () => {
    const d = deps();
    expect(await runPracticeFlow(link("https://other.example.org/a.zip"), d)).toEqual(notice(MSG_BAD_ORIGIN));
    expect(await runPracticeFlow(link(`https://sub.${HOST}/a.zip`), d)).toEqual(notice(MSG_BAD_ORIGIN));
    expect(await runPracticeFlow(link(`http://${HOST}/a.zip`), d)).toEqual(notice(MSG_BAD_ORIGIN));
    expect(d.download?.fetch).not.toHaveBeenCalled();
  });

  it("an empty host list refuses every link", async () => {
    expect(await runPracticeFlow(link(SRC), deps({ fetchHosts: async () => [] }))).toEqual(notice(MSG_BAD_ORIGIN));
  });

  it("an allowed host is downloaded, imported with its source and opened; the same link opens the copy", async () => {
    const d = deps();
    const first = await runPracticeFlow(link(SRC), d);
    expect(first.kind).toBe("open");
    expect(d.onLoading).toHaveBeenCalledWith({ kind: "info", text: MSG_LOADING });
    expect(d.download?.fetch).toHaveBeenCalledTimes(1);
    const second = await runPracticeFlow(link(SRC), d);
    expect(second).toEqual(first);
    expect(d.download?.fetch).toHaveBeenCalledTimes(1);
    expect((await store.list()).exercises).toHaveLength(1);
  });

  it("a redirect to a host outside the list is refused", async () => {
    const f = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.example.com/a.zip" } }));
    const d = deps({ download: { fetch: f as unknown as typeof fetch } });
    expect(await runPracticeFlow(link(SRC), d)).toEqual(notice(MSG_BAD_ORIGIN));
    expect(f).toHaveBeenCalledTimes(1);
    expect((await store.list()).exercises).toHaveLength(0);
  });

  it("a redirect within the list is followed", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: `https://${HOST}/practice/b.zip` } }))
      .mockResolvedValueOnce(new Response(new Uint8Array(goodZip())));
    const d = deps({ download: { fetch: f as unknown as typeof fetch } });
    expect((await runPracticeFlow(link(SRC), d)).kind).toBe("open");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("without a Scratch store nothing happens", async () => {
    expect((await runPracticeFlow(link(SRC), deps({ scratch: undefined }))).kind).toBe("notice");
  });
});
