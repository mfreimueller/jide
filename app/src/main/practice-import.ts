import { MAX_PACKAGE_BYTES } from "@jide/shared";
import { MSG_BAD_ORIGIN } from "./deep-link";
import type { ScratchStore } from "./scratch";

/** Electron-free download + import of a practice exercise (unit-tested with a stubbed fetch). */
export const MSG_OFFLINE = "Die Übung konnte nicht geladen werden. Bist du mit dem Internet verbunden?";
export const MSG_NOT_FOUND = "Diese Übung gibt es auf der Kursseite nicht (mehr).";
export const MSG_TOO_BIG = "Die Übung ist zu groß.";
export const MSG_LOADING = "Übung wird geladen …";
export const messageHttpStatus = (status: number): string => `Die Übung konnte nicht geladen werden (Fehler ${status}).`;

export const DOWNLOAD_TIMEOUT_MS = 20_000;
export const MAX_REDIRECTS = 3;

export type DownloadResult = { ok: true; bytes: Uint8Array } | { ok: false; message: string };

export interface DownloadOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  /** Every redirect target must pass this (the course host list). */
  isAllowed: (url: string) => boolean;
}

/** Downloads `src` (timeout, size limit, at most 3 redirects, each target host-checked). Never throws. */
export async function downloadPractice(src: string, opts: DownloadOptions): Promise<DownloadResult> {
  const doFetch = opts.fetch ?? fetch;
  const maxBytes = opts.maxBytes ?? MAX_PACKAGE_BYTES;
  const isAllowed = opts.isAllowed;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DOWNLOAD_TIMEOUT_MS);
  try {
    let url = src;
    for (let hops = 0; ; hops++) {
      const res = await doFetch(url, { redirect: "manual", signal: ctrl.signal });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => undefined);
        if (!location || hops >= MAX_REDIRECTS) return { ok: false, message: messageHttpStatus(res.status) };
        let next: string;
        try {
          next = new URL(location, url).toString();
        } catch {
          return { ok: false, message: MSG_BAD_ORIGIN };
        }
        if (!isAllowed(next)) return { ok: false, message: MSG_BAD_ORIGIN };
        url = next;
        continue;
      }
      if (res.status === 404) return { ok: false, message: MSG_NOT_FOUND };
      if (res.status < 200 || res.status >= 300) return { ok: false, message: messageHttpStatus(res.status) };
      const announced = Number(res.headers.get("content-length"));
      if (Number.isFinite(announced) && announced > maxBytes) {
        await res.body?.cancel().catch(() => undefined);
        return { ok: false, message: MSG_TOO_BIG };
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (res.body) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) {
            await reader.cancel().catch(() => undefined);
            return { ok: false, message: MSG_TOO_BIG };
          }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        bytes.set(c, at);
        at += c.byteLength;
      }
      return { ok: true, bytes };
    }
  } catch {
    return { ok: false, message: MSG_OFFLINE }; // network failure, abort (timeout), body read error
  } finally {
    clearTimeout(timer);
  }
}

export type PracticeOutcome = { kind: "open"; id: string } | { kind: "error"; message: string };

/**
 * An existing copy with the same source opens without a download; otherwise download and import.
 * `onDownload` fires right before the network is used (the "Übung wird geladen …" notice).
 */
export async function importPractice(
  src: string,
  scratch: ScratchStore | undefined,
  onDownload: () => void = () => undefined,
  opts: DownloadOptions
): Promise<PracticeOutcome> {
  if (!scratch) return { kind: "error", message: "Scratch gibt es in der Prüfung nicht." };
  const existing = await scratch.findBySource(src);
  if (existing) return { kind: "open", id: existing };
  onDownload();
  const dl = await downloadPractice(src, opts);
  if (!dl.ok) return { kind: "error", message: dl.message };
  const r = await scratch.importZipBuffer(dl.bytes, src);
  return r.ok ? { kind: "open", id: r.id } : { kind: "error", message: r.message };
}
