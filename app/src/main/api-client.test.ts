import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, OFFLINE_MESSAGE, SESSION_EXPIRED_MESSAGE } from "./api-client";

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function client(fetchFn: typeof fetch, code: string | undefined = "ABCD2345") {
  const onUnauthorized = vi.fn();
  const api = new ApiClient({ baseUrl: "http://srv/", getCode: () => code, onUnauthorized, fetch: fetchFn });
  return { api, onUnauthorized };
}

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error("expected a failure");
}

describe("ApiClient", () => {
  it("sends the code as Bearer token and parses the list", async () => {
    const f = vi.fn(async () => json(200, { exercises: [{ id: "a", title: "A", version: "v1", deadline: null }] }));
    const { api } = client(f as unknown as typeof fetch);
    expect(await api.exercises()).toEqual({
      exercises: [{ id: "a", title: "A", version: "v1", deadline: null }],
      groups: []
    });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://srv/api/exercises");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer ABCD2345");
  });

  it("login sends the code in the body, without Authorization", async () => {
    const f = vi.fn(async () => json(200, { name: "Anna", course: { subject: "POS", className: "1AHIF" } }));
    const { api } = client(f as unknown as typeof fetch);
    expect((await api.login("ABCD2345")).name).toBe("Anna");
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toEqual({ code: "ABCD2345" });
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("401 on login keeps the server message and does not report an expired session", async () => {
    const { api, onUnauthorized } = client((async () => json(401, { error: "UNAUTHORIZED", message: "Dieser Code ist ungültig." })) as typeof fetch);
    const e = await failure(api.login("X"));
    expect(e.kind).toBe("unauthorized");
    expect(e.message).toBe("Dieser Code ist ungültig.");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("401 on any other request reports the expired session", async () => {
    const { api, onUnauthorized } = client((async () => json(401, { error: "UNAUTHORIZED", message: "x" })) as typeof fetch);
    const e = await failure(api.exercises());
    expect(e.kind).toBe("unauthorized");
    expect(e.message).toBe(SESSION_EXPIRED_MESSAGE);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("429 shows the server message", async () => {
    const { api } = client((async () => json(429, { error: "RATE_LIMITED", message: "Zu viele falsche Versuche. Bitte warte ein paar Minuten." })) as typeof fetch);
    const e = await failure(api.login("X"));
    expect(e.kind).toBe("rate-limited");
    expect(e.message).toBe("Zu viele falsche Versuche. Bitte warte ein paar Minuten.");
  });

  it("5xx counts as offline", async () => {
    const { api } = client((async () => json(503, { message: "kaputt" })) as typeof fetch);
    const e = await failure(api.exercises());
    expect(e.kind).toBe("offline");
    expect(e.message).toBe(OFFLINE_MESSAGE);
  });

  it("network errors and timeouts count as offline", async () => {
    const { api } = client((async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);
    expect((await failure(api.exercises())).kind).toBe("offline");
    const { api: slow } = client((async () => {
      throw new DOMException("timeout", "TimeoutError");
    }) as typeof fetch);
    expect((await failure(slow.handIn("a", { files: [], testSummary: null }))).kind).toBe("offline");
  });

  it("an answer that is not JSON counts as offline", async () => {
    const { api } = client((async () => new Response("<html>Login to wifi</html>", { status: 200 })) as typeof fetch);
    expect((await failure(api.exercises())).kind).toBe("offline");
  });

  it("other 4xx show the server message, with a fallback", async () => {
    const { api } = client((async () => json(400, { error: "X", message: "Datei nicht erlaubt." })) as typeof fetch);
    const e = await failure(api.handIn("a", { files: [], testSummary: null }));
    expect(e.kind).toBe("client");
    expect(e.message).toBe("Datei nicht erlaubt.");
    const { api: bare } = client((async () => new Response("", { status: 400 })) as typeof fetch);
    expect((await failure(bare.handIn("a", { files: [], testSummary: null }))).message).toBe("Das hat leider nicht geklappt.");
  });

  it("package download sends If-None-Match and understands 304", async () => {
    const f = vi.fn(async () => new Response(null, { status: 304 }));
    const { api } = client(f as unknown as typeof fetch);
    expect(await api.downloadPackage("a", "v1")).toEqual({ notModified: true });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe('"v1"');
  });

  it("package download returns bytes and the unquoted ETag", async () => {
    const { api } = client((async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { ETag: '"v2"' } })) as typeof fetch);
    const r = await api.downloadPackage("a");
    expect(r).toEqual({ notModified: false, zip: new Uint8Array([1, 2, 3]), version: "v2" });
  });

  it("latestHandIn maps 404 to null but rethrows other errors", async () => {
    const { api } = client((async () => json(404, { message: "Keine Abgabe." })) as typeof fetch);
    expect(await api.latestHandIn("a")).toBeNull();
    const { api: down } = client((async () => json(500, {})) as typeof fetch);
    expect((await failure(down.latestHandIn("a"))).kind).toBe("offline");
  });
});
