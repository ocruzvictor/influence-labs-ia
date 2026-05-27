/**
 * Preloaded via `node --import tsx --import ./tests/setup.ts`.
 * Sets stub env vars so lib/env.ts validation passes during unit tests.
 */

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.ADMIN_JWT_SECRET = "a".repeat(64);
process.env.RESEND_API_KEY = "re_test_value_for_unit_tests";
process.env.RESEND_FROM_EMAIL = "auth-test@example.com";
process.env.ADMIN_PUBLIC_URL = "http://localhost:3002";
(process.env as Record<string, string | undefined>).NODE_ENV ??= "test";
