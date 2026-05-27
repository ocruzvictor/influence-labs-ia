/**
 * In-memory LRU rate limiter — enough for MVP (3 admin users, low volume).
 * Migrate to Redis when admin scales >10 users or when running multiple replicas.
 */

import { LRUCache } from "lru-cache";

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

interface RateLimiter {
  /** Returns { ok, remaining, resetIn (ms) }. `ok=false` means limit exceeded. */
  check(key: string): { ok: boolean; remaining: number; resetIn: number };
}

export interface RateLimitOptions {
  /** Max requests per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max distinct keys retained in memory. */
  maxKeys?: number;
}

export function createRateLimiter(opts: RateLimitOptions): RateLimiter {
  const cache = new LRUCache<string, Bucket>({
    max: opts.maxKeys ?? 5_000,
    ttl: opts.windowMs,
  });

  return {
    check(key: string) {
      const now = Date.now();
      const existing = cache.get(key);

      if (!existing || existing.resetAt <= now) {
        cache.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { ok: true, remaining: opts.max - 1, resetIn: opts.windowMs };
      }

      if (existing.count >= opts.max) {
        return { ok: false, remaining: 0, resetIn: existing.resetAt - now };
      }

      existing.count += 1;
      return {
        ok: true,
        remaining: opts.max - existing.count,
        resetIn: existing.resetAt - now,
      };
    },
  };
}

// 3 magic-link requests per minute per email
export const magicLinkLimiter = createRateLimiter({
  max: 3,
  windowMs: 60_000,
  maxKeys: 1_000,
});
