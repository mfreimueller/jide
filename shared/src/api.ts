// Request/response shapes of the student-facing backend API (SPEC §5). Used by the backend and the app.

/** Error body of every non-2xx JSON response. `message` is German and safe to show. */
export interface ApiErrorBody {
  error: string;
  message: string;
}

/** POST /api/student/login and GET /api/student/me */
export interface StudentSession {
  name: string;
  course: { subject: string; className: string };
}

/** One unlocked exercise in GET /api/exercises. */
export interface StudentExerciseSummary {
  /** Exercise id from exercise.yaml. */
  id: string;
  title: string;
  /** sha256 (hex) of the package; also the ETag of GET /api/exercises/:id (quoted). */
  version: string;
  /** Soft deadline as ISO 8601 instant (UTC), or null. */
  deadline: string | null;
  /** Group of the course (see `groups`), null = ungrouped. Missing in answers of older backends. */
  groupId?: number | null;
}

/** An exercise group of the course, as the students see it. */
export interface StudentExerciseGroup {
  id: number;
  name: string;
}

/**
 * GET /api/exercises. `exercises` come in the teacher's order (grouped ones first, then the ungrouped).
 * `groups` are in the teacher's order and only those with at least one visible exercise.
 * Older backends omit `groups`; treat that as "no groups".
 */
export interface StudentExerciseListResponse {
  exercises: StudentExerciseSummary[];
  groups?: StudentExerciseGroup[];
}

/**
 * GET /api/exercises/:id answers with the zip (Content-Type application/zip), not JSON.
 * Layout: a single folder `<id>/` containing exercise.yaml, aufgabe.md, files/, ...
 * Send `If-None-Match: "<version>"` to get 304 when the cached package is current.
 */
export const EXERCISE_PACKAGE_CONTENT_TYPE = "application/zip";

/** Result of the local test run, sent with a hand-in. */
export interface TestSummary {
  passed: number;
  total: number;
}

export interface HandInFile {
  /** Path from exercise.yaml (relative to files/), e.g. `Summe.java`. */
  path: string;
  content: string;
}

/**
 * POST /api/exercises/:id/handins. Only editable files of the exercise are accepted
 * (max 50 files, 1 MB of content in total). The server sets the timestamp.
 */
export interface HandInRequest {
  files: HandInFile[];
  testSummary: TestSummary | null;
}

/** Response of POST /api/exercises/:id/handins (201). */
export interface HandInResponse {
  /** Server time, ISO 8601 UTC. */
  submittedAt: string;
  /** True if the course deadline of the exercise had passed (hand-ins are accepted anyway). */
  late: boolean;
}

/** GET /api/exercises/:id/handins/latest (404 if the student has not handed in yet). */
export interface LatestHandInResponse {
  submittedAt: string;
  files: HandInFile[];
}
