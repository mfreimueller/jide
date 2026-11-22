import type { AppNotice } from "../shared-types/api";
import { ApiError } from "./api-client";
import { isAllowedPracticeSrc, MSG_BAD_ORIGIN, MSG_EXAM_MODE, MSG_LOGIN_REQUIRED, parseDeepLink } from "./deep-link";
import { importPractice, MSG_LOADING, MSG_OFFLINE, type DownloadOptions } from "./practice-import";
import type { ScratchStore } from "./scratch";

/** Electron-free order of handling a `jide://` link (unit-tested with stubs). */
export interface PracticeFlowDeps {
  examMode: boolean;
  /** Online mode with a stored personal code. Local (JIDE_EXERCISES_DIR) mode has no account: false. */
  signedIn: boolean;
  scratch: ScratchStore | undefined;
  /** The hosts of the student's course (GET /api/student/practice-hosts). */
  fetchHosts: () => Promise<string[]>;
  /** Shown right before the download starts. */
  onLoading: (notice: AppNotice) => void;
  /** Tests only; see `practiceInsecure`. */
  insecure?: boolean;
  download?: Pick<DownloadOptions, "fetch" | "timeoutMs" | "maxBytes">;
}

export type PracticeFlowOutcome = { kind: "open"; id: string } | { kind: "notice"; notice: AppNotice };

const error = (text: string): PracticeFlowOutcome => ({ kind: "notice", notice: { kind: "error", text } });

/**
 * exam mode -> notice; parse; not signed in -> notice; existing Scratch copy of this source -> open it (no network,
 * no host check); fetch the course hosts; check `src`; download (every redirect target checked) and import.
 */
export async function runPracticeFlow(raw: string, d: PracticeFlowDeps): Promise<PracticeFlowOutcome> {
  if (d.examMode) return { kind: "notice", notice: { kind: "info", text: MSG_EXAM_MODE } };
  const link = parseDeepLink(raw);
  if (link.kind === "error") return error(link.message);
  if (!d.signedIn) return { kind: "notice", notice: { kind: "info", text: MSG_LOGIN_REQUIRED } };
  if (!d.scratch) return error("Scratch gibt es in der Prüfung nicht.");
  const existing = await d.scratch.findBySource(link.src);
  if (existing) return { kind: "open", id: existing };

  let hosts: string[];
  try {
    hosts = await d.fetchHosts();
  } catch (e) {
    // 401: the ApiClient has already cleared the session and told the window (login screen).
    return error(e instanceof ApiError && e.kind !== "offline" ? e.message : MSG_OFFLINE);
  }
  const isAllowed = (u: string): boolean => isAllowedPracticeSrc(u, hosts, d.insecure);
  if (!isAllowed(link.src)) return error(MSG_BAD_ORIGIN);

  const out = await importPractice(link.src, d.scratch, () => d.onLoading({ kind: "info", text: MSG_LOADING }), {
    ...d.download,
    isAllowed
  });
  return out.kind === "open" ? out : error(out.message);
}
