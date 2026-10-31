import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message?: string,
    public readonly extra: Record<string, unknown> = {}
  ) {
    super(message ?? code);
  }
}
