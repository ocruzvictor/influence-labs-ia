/**
 * Environment validation — fail fast at boot if anything is missing/malformed.
 *
 * Add a new var to the schema, document it in .env.example, then use `env.X` anywhere.
 * Never read process.env.* directly outside this file.
 */

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  ADMIN_JWT_SECRET: z
    .string()
    .min(64, "ADMIN_JWT_SECRET must be ≥64 chars. Generate: openssl rand -base64 64"),

  RESEND_API_KEY: z.string().startsWith("re_", "RESEND_API_KEY must start with 're_'"),
  RESEND_FROM_EMAIL: z.string().email(),

  ADMIN_PUBLIC_URL: z.string().url(),

  // Optional — only used by Story 1.3+ (backend toggles/whitelist endpoints)
  BACKEND_INTERNAL_URL: z.string().url().optional().or(z.literal("")),
  BACKEND_INTERNAL_TOKEN: z.string().min(32).optional().or(z.literal("")),

  // Story 1.5: TESS API integration for KB editor
  // TESS_API_TOKEN é compartilhado com backend Tirra (mesmo Bearer token)
  // TIRRA_KB_COLLECTION_ID é opcional — quando ausente, mutations no /api/kb retornam 503
  TESS_API_TOKEN: z.string().min(8).optional().or(z.literal("")),
  TESS_API_BASE: z.string().url().optional().or(z.literal("")),
  TESS_WORKSPACE_ID: z
    .string()
    .regex(/^\d+$/, "TESS_WORKSPACE_ID must be digits only")
    .optional()
    .or(z.literal("")),
  TIRRA_KB_COLLECTION_ID: z
    .string()
    .regex(/^\d+$/, "TIRRA_KB_COLLECTION_ID must be a positive integer")
    .optional()
    .or(z.literal("")),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  throw new Error("Environment validation failed. See errors above.");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

export const isProd = env.NODE_ENV === "production";
