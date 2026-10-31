import type { Context, Next } from 'hono';
import { AppError } from '../errors.js';
import { clientIp } from './http.js';

// In-memory, fixed per process. Fine for a single Node process.
const hits = new Map<string, number[]>();

export function hit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}

export function resetRateLimits(): void {
  hits.clear();
  failures.clear();
}

export function rateLimit(name: string, max: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    if (!hit(`${name}:${clientIp(c)}`, max, windowMs)) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment.');
    }
    await next();
  };
}

// Counts only failures. A whole class shares one school IP, so successful logins must never be
// limited, while someone guessing codes runs into the wall quickly.
const failures = new Map<string, number[]>();

export function tooManyFailures(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (failures.get(key) ?? []).filter((t) => now - t < windowMs);
  failures.set(key, recent);
  return recent.length >= max;
}

export function recordFailure(key: string, now = Date.now()): void {
  const list = failures.get(key) ?? [];
  list.push(now);
  failures.set(key, list);
  if (failures.size > 10_000) {
    for (const [k, v] of failures) if (v.every((t) => now - t >= 3_600_000)) failures.delete(k);
  }
}

export function resetFailureLimits(): void {
  failures.clear();
}
