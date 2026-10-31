import type {
  HandInRequest,
  HandInResponse,
  LatestHandInResponse,
  StudentExerciseListResponse,
  StudentExerciseSummary,
  StudentSession
} from "@jide/shared";

export const OFFLINE_MESSAGE = "Keine Verbindung – versuch es gleich nochmal.";
export const SESSION_EXPIRED_MESSAGE =
  "Dein Code ist nicht mehr gültig. Frag deine Lehrkraft nach dem neuen Zettel.";
const RATE_LIMITED_FALLBACK = "Zu viele Versuche. Bitte warte ein paar Minuten.";
const GENERIC_FAILURE = "Das hat leider nicht geklappt.";

/**
 * offline: server unreachable, network error, timeout, 5xx or an answer that is not what we expect
 * unauthorized: 401 (for the login: wrong code; otherwise: the stored code is no longer valid)
 * rate-limited: 429
 * client: any other 4xx
 */
export type ApiErrorKind = "offline" | "unauthorized" | "rate-limited" | "client";

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    /** German, safe to show to the student. */
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** The stored personal code, sent as `Authorization: Bearer`. */
  getCode: () => string | undefined;
  /** Called for every 401 of an authenticated request (not for the login itself). */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
  /** Timeout of JSON requests; packages get four times as much. */
  timeoutMs?: number;
}

export type PackageDownload =
  | { notModified: true }
  | { notModified: false; zip: Uint8Array; version: string };

function serverMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === "string" && m.trim() !== "") return m;
  }
  return undefined;
}

function stripQuotes(etag: string | null): string | undefined {
  if (!etag) return undefined;
  return etag.replace(/^W\//, "").replace(/^"|"$/g, "") || undefined;
}

export class ApiClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: ApiClientOptions) {
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  /** POST /api/student/login. A 401 here carries the server's message ("Dieser Code ist ungültig …"). */
  login(code: string): Promise<StudentSession> {
    return this.json<StudentSession>("POST", "/api/student/login", { auth: false, body: { code } });
  }

  async exercises(): Promise<StudentExerciseSummary[]> {
    const r = await this.json<StudentExerciseListResponse>("GET", "/api/exercises");
    if (!Array.isArray(r?.exercises)) throw new ApiError("offline", OFFLINE_MESSAGE);
    return r.exercises;
  }

  /** `cachedVersion` is sent as `If-None-Match`; 304 yields `{ notModified: true }`. */
  async downloadPackage(id: string, cachedVersion?: string): Promise<PackageDownload> {
    const headers: Record<string, string> = {};
    if (cachedVersion) headers["If-None-Match"] = `"${cachedVersion}"`;
    const res = await this.request("GET", `/api/exercises/${encodeURIComponent(id)}`, {
      headers,
      timeoutMs: this.timeoutMs * 4
    });
    if (res.status === 304) return { notModified: true };
    try {
      const zip = new Uint8Array(await res.arrayBuffer());
      const version = stripQuotes(res.headers.get("ETag"));
      if (!version || zip.length === 0) throw new Error("incomplete package");
      return { notModified: false, zip, version };
    } catch {
      throw new ApiError("offline", OFFLINE_MESSAGE);
    }
  }

  /** The last hand-in, or null if the student has not handed in yet (404). */
  async latestHandIn(id: string): Promise<LatestHandInResponse | null> {
    try {
      return await this.json<LatestHandInResponse>("GET", `/api/exercises/${encodeURIComponent(id)}/handins/latest`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  handIn(id: string, req: HandInRequest): Promise<HandInResponse> {
    return this.json<HandInResponse>("POST", `/api/exercises/${encodeURIComponent(id)}/handins`, { body: req });
  }

  private async json<T>(method: string, path: string, o: { auth?: boolean; body?: unknown } = {}): Promise<T> {
    const res = await this.request(method, path, o);
    try {
      return (await res.json()) as T;
    } catch {
      // 200 with something that is not JSON, e.g. a captive portal page
      throw new ApiError("offline", OFFLINE_MESSAGE);
    }
  }

  /** Sends the request and maps every failure to an ApiError. Returns only 2xx and 304 responses. */
  private async request(
    method: string,
    path: string,
    o: { auth?: boolean; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {}
  ): Promise<Response> {
    const auth = o.auth !== false;
    const headers: Record<string, string> = { ...o.headers };
    if (auth) {
      const code = this.opts.getCode();
      if (code) headers["Authorization"] = `Bearer ${code}`;
    }
    if (o.body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await this.fetchFn(this.opts.baseUrl.replace(/\/+$/, "") + path, {
        method,
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: AbortSignal.timeout(o.timeoutMs ?? this.timeoutMs)
      });
    } catch {
      throw new ApiError("offline", OFFLINE_MESSAGE);
    }
    if (res.ok || res.status === 304) return res;

    let message: string | undefined;
    try {
      message = serverMessage(await res.json());
    } catch {
      message = undefined;
    }
    if (res.status >= 500) throw new ApiError("offline", OFFLINE_MESSAGE, res.status);
    if (res.status === 401) {
      if (!auth) throw new ApiError("unauthorized", message ?? SESSION_EXPIRED_MESSAGE, 401);
      this.opts.onUnauthorized?.();
      throw new ApiError("unauthorized", SESSION_EXPIRED_MESSAGE, 401);
    }
    if (res.status === 429) throw new ApiError("rate-limited", message ?? RATE_LIMITED_FALLBACK, 429);
    throw new ApiError("client", message ?? GENERIC_FAILURE, res.status);
  }
}
