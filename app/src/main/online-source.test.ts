import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, type ApiClient } from "./api-client";
import { GRADE_UNAVAILABLE_MESSAGE, OnlineSource } from "./online-source";
import { PackageCache } from "./package-cache";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jide-online-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("OnlineSource difficulty", () => {
  it("keeps the difficulty through the offline cache; missing or unknown values become null", async () => {
    const cache = new PackageCache(dir);
    const base = { version: "v1", deadline: null };
    await cache.writeList([
      { ...base, id: "a", title: "A", difficulty: "pro" },
      { ...base, id: "b", title: "B", difficulty: null },
      { ...base, id: "c", title: "C" },
      { ...base, id: "d", title: "D", difficulty: "expert" as never }
    ]);
    const api = {
      exercises: async () => {
        throw new ApiError("offline", "offline");
      }
    } as unknown as ApiClient;

    const listing = await new OnlineSource(api, cache).list();
    expect(listing.offline).toBe(true);
    expect(listing.exercises.map((e) => [e.id, e.difficulty])).toEqual([
      ["a", "pro"],
      ["b", null],
      ["c", null],
      ["d", null]
    ]);
  });
});

describe("OnlineSource grades", () => {
  const base = { version: "v1", deadline: null };
  const grade = { symbol: "PLUS_WELLE", gradedAt: "2026-11-16T09:00:00.000Z" } as const;
  const full = {
    ...grade,
    comment: "Gut",
    handinId: 7,
    submittedAt: "2026-11-12T09:42:00.000Z",
    files: [{ path: "Main.java", content: "void main() {}" }],
    lineComments: [{ path: "Main.java", line: 1, text: "Hm" }]
  };
  const offline = async () => {
    throw new ApiError("offline", "offline");
  };

  it("the list keeps the grade through the offline cache; unknown symbols are ignored", async () => {
    const cache = new PackageCache(dir);
    await cache.writeList([
      { ...base, id: "a", title: "A", grade },
      { ...base, id: "b", title: "B", grade: null },
      { ...base, id: "c", title: "C", grade: { symbol: "X" as never, gradedAt: "2026-11-16T09:00:00.000Z" } },
      { ...base, id: "d", title: "D" }
    ]);
    const listing = await new OnlineSource({ exercises: offline } as unknown as ApiClient, cache).list();
    expect(listing.exercises.map((e) => [e.id, e.grade])).toEqual([["a", grade], ["b", null], ["c", null], ["d", null]]);
  });

  it("gradedView: null for ungraded exercises, caches the grade, serves it offline", async () => {
    const cache = new PackageCache(dir);
    await cache.writeList([{ ...base, id: "a", title: "A", grade }, { ...base, id: "b", title: "B" }]);
    let online = true;
    const api = { grade: async () => (online ? full : offline()) } as unknown as ApiClient;
    const source = new OnlineSource(api, cache);
    expect(await source.gradedView("b")).toBeNull();
    expect(await source.gradedView("a")).toEqual({ ok: true, grade: full });
    online = false;
    expect(await source.gradedView("a")).toEqual({ ok: true, grade: full });
  });

  it("gradedView offline without a (matching) cached grade gives the offline message", async () => {
    const cache = new PackageCache(dir);
    await cache.writeList([{ ...base, id: "a", title: "A", grade }]);
    const source = new OnlineSource({ grade: offline } as unknown as ApiClient, cache);
    expect(await source.gradedView("a")).toEqual({ ok: false, message: GRADE_UNAVAILABLE_MESSAGE });
    await cache.writeGrade("a", { ...full, gradedAt: "2026-11-01T00:00:00.000Z" }); // an older grade
    expect(await source.gradedView("a")).toEqual({ ok: false, message: GRADE_UNAVAILABLE_MESSAGE });
  });

  it("a hand-in answered with GRADED is marked graded", async () => {
    const api = {
      handIn: async () => {
        throw new ApiError("client", "Diese Aufgabe ist bereits beurteilt.", 409, "GRADED");
      }
    } as unknown as ApiClient;
    const r = await new OnlineSource(api, new PackageCache(dir)).handIn({ id: "a" } as never, [], null);
    expect(r).toEqual({ ok: false, message: "Diese Aufgabe ist bereits beurteilt.", graded: true });
  });
});
