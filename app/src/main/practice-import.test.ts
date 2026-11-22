import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MSG_BAD_ORIGIN } from "./deep-link";
import {
  downloadPractice,
  importPractice,
  messageHttpStatus,
  MSG_NOT_FOUND,
  MSG_OFFLINE,
  MSG_TOO_BIG
} from "./practice-import";
import { scratchEntry } from "./composite-source";
import { ScratchStore } from "./scratch";

const SRC = "https://example.test/p/a.zip";
const allow = (u: string): boolean => u.startsWith("https://example.test/p/");

const reply = (body: BodyInit | Uint8Array, init: ResponseInit = {}): Response => new Response(body as BodyInit, init);
const stub = (...answers: Array<Response | Error>): typeof fetch => {
  const queue = [...answers];
  return vi.fn(async () => {
    const a = queue.shift();
    if (!a) throw new Error("unexpected request");
    if (a instanceof Error) throw a;
    return a;
  }) as unknown as typeof fetch;
};

describe("downloadPractice", () => {
  it("returns the bytes", async () => {
    const r = await downloadPractice(SRC, { fetch: stub(reply("abc")), isAllowed: allow });
    expect(r.ok && Buffer.from(r.bytes).toString()).toBe("abc");
  });
  it("404 and other statuses have their own messages", async () => {
    expect(await downloadPractice(SRC, { fetch: stub(reply("", { status: 404 })), isAllowed: allow })).toEqual({ ok: false, message: MSG_NOT_FOUND });
    expect(await downloadPractice(SRC, { fetch: stub(reply("", { status: 503 })), isAllowed: allow })).toEqual({ ok: false, message: messageHttpStatus(503) });
  });
  it("a network error is the offline message", async () => {
    expect(await downloadPractice(SRC, { fetch: stub(new TypeError("fetch failed")), isAllowed: allow })).toEqual({ ok: false, message: MSG_OFFLINE });
  });
  it("times out", async () => {
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await downloadPractice(SRC, { fetch: hang, timeoutMs: 30, isAllowed: allow })).toEqual({ ok: false, message: MSG_OFFLINE });
  });
  it("stops at the size limit, announced or streamed", async () => {
    const announced = reply("x", { headers: { "content-length": "100" } });
    expect(await downloadPractice(SRC, { fetch: stub(announced), maxBytes: 10, isAllowed: allow })).toEqual({ ok: false, message: MSG_TOO_BIG });
    const big = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(6));
      }
    });
    expect(await downloadPractice(SRC, { fetch: stub(reply(big)), maxBytes: 10, isAllowed: allow })).toEqual({
      ok: false,
      message: MSG_TOO_BIG
    });
  });
  it("follows allowed redirects (relative too), at most 3", async () => {
    const redirect = (to: string): Response => reply("", { status: 302, headers: { location: to } });
    const ok = await downloadPractice(SRC, { fetch: stub(redirect("b.zip"), redirect("/p/c.zip"), reply("z")), isAllowed: allow });
    expect(ok.ok).toBe(true);
    const many = await downloadPractice(SRC, {
      fetch: stub(redirect("b.zip"), redirect("c.zip"), redirect("d.zip"), redirect("e.zip"), reply("z")),
      isAllowed: allow
    });
    expect(many).toEqual({ ok: false, message: messageHttpStatus(302) });
  });
  it("a redirect to another origin fails with the origin error and is not requested", async () => {
    const f = stub(reply("", { status: 301, headers: { location: "https://evil.test/a.zip" } }), reply("never"));
    expect(await downloadPractice(SRC, { fetch: f, isAllowed: allow })).toEqual({ ok: false, message: MSG_BAD_ORIGIN });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("importPractice", () => {
  let tmp: string;
  let store: ScratchStore;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "jide-practice-"));
    store = new ScratchStore(join(tmp, "scratch"));
  });
  afterEach(() => rm(tmp, { recursive: true, force: true }));

  const goodZip = (): Buffer => Buffer.from(
    zipSync({
      "exercise.yaml": strToU8("id: summe\ntitle: Summe\nfiles:\n  - path: Summe.java\nmainFile: Summe.java\n"),
      "aufgabe.md": strToU8("# Summe\n"),
      "files/Summe.java": strToU8("class Summe {}")
    }));

  it("imports, remembers the source, and the same source opens the same copy without a download", async () => {
    const first = await importPractice(SRC, store, undefined, { fetch: stub(reply(goodZip())), isAllowed: allow });
    expect(first.kind).toBe("open");
    if (first.kind !== "open") return;
    expect((await store.importedInfo(first.id))?.source).toBe(SRC);
    expect(JSON.parse(await readFile(join(tmp, "scratch", first.id, "imported.json"), "utf8")).source).toBe(SRC);
    const f = stub();
    const second = await importPractice(SRC, store, undefined, { fetch: f, isAllowed: allow });
    expect(second).toEqual({ kind: "open", id: first.id });
    expect(f).not.toHaveBeenCalled();
    expect((await store.list()).exercises).toHaveLength(1);
  });
  it("a practice link is always an Übung (whatever the yaml says) and still accepts the retired difficulty key", async () => {
    const zipWith = (extra: string): Buffer =>
      Buffer.from(
        zipSync({
          "exercise.yaml": strToU8(`id: summe\ntitle: Summe\nfiles:\n  - path: Summe.java\nmainFile: Summe.java\n${extra}`),
          "aufgabe.md": strToU8("# Summe\n"),
          "files/Summe.java": strToU8("class Summe {}")
        })
      );
    for (const [i, extra] of ["", "kind: bonus\n", "kind: pflicht\n", "difficulty: newbie\n"].entries()) {
      const src = `${SRC}?v=${i}`;
      const r = await importPractice(src, store, undefined, { fetch: stub(reply(zipWith(extra))), isAllowed: allow });
      expect(r.kind).toBe("open");
      if (r.kind !== "open") return;
      const ex = (await store.find(r.id))!;
      expect(ex.kind).toBe("uebung");
      const { exercises, imported } = await store.list();
      expect(scratchEntry(exercises.find((e) => e.id === r.id)!, imported.get(r.id))).toMatchObject({ kind: "uebung" });
    }
  });
  it("source lookup is an exact string match", async () => {
    await importPractice(SRC, store, undefined, { fetch: stub(reply(goodZip())), isAllowed: allow });
    expect(await store.findBySource(SRC + "?x=1")).toBeUndefined();
    expect(await store.findBySource(SRC.toUpperCase())).toBeUndefined();
  });
  it("imports made without a source stay valid and are never found", async () => {
    const r = await store.importZipBuffer(goodZip());
    expect(r.ok).toBe(true);
    if (r.ok) expect((await store.importedInfo(r.id))?.source).toBeUndefined();
    expect(await store.findBySource("")).toBeUndefined();
  });
  it("a download that is not a zip / has a bad exercise.yaml reports the import error, nothing imported", async () => {
    const notZip = await importPractice(SRC, store, undefined, { fetch: stub(reply("hello")), isAllowed: allow });
    expect(notZip.kind).toBe("error");
    const bad = await importPractice(SRC, store, undefined, { fetch: stub(reply(Buffer.from(zipSync({ "exercise.yaml": strToU8("title: x\n") })))), isAllowed: allow });
    expect(bad.kind).toBe("error");
    expect((await store.list()).exercises).toHaveLength(0);
  });
  it("announces the download only when the network is used", async () => {
    const onDownload = vi.fn();
    await importPractice(SRC, store, onDownload, { fetch: stub(reply(goodZip())), isAllowed: allow });
    expect(onDownload).toHaveBeenCalledTimes(1);
    await importPractice(SRC, store, onDownload, { fetch: stub(), isAllowed: allow });
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
  it("without a Scratch store (exam mode) nothing is downloaded", async () => {
    const f = stub();
    expect((await importPractice(SRC, undefined, undefined, { fetch: f, isAllowed: allow })).kind).toBe("error");
    expect(f).not.toHaveBeenCalled();
  });
});
