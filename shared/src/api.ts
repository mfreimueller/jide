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
}

/** GET /api/exercises */
export interface StudentExerciseListResponse {
  exercises: StudentExerciseSummary[];
}

/**
 * GET /api/exercises/:id answers with the zip (Content-Type application/zip), not JSON.
 * Layout: a single folder `<id>/` containing exercise.yaml, aufgabe.md, files/, ...
 * Send `If-None-Match: "<version>"` to get 304 when the cached package is current.
 */
export const EXERCISE_PACKAGE_CONTENT_TYPE = "application/zip";
