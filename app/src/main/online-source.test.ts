import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, type ApiClient } from "./api-client";
import { OnlineSource } from "./online-source";
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
