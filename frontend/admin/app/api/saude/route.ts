/**
 * /api/saude — proxy do backend /health com cache server-side.
 *
 * Story 1.7 — Saúde + Auditoria.
 *
 * GET → repassa JSON do `${BACKEND_INTERNAL_URL}/health` com cache 5s pra
 * absorver polling (10s no client × múltiplas abas).
 *
 * Cache aplicado SÓ em sucesso. Falha de upstream retorna 200 com
 * `{status:"degraded", backend_unreachable:true}` (graceful) sem cachear —
 * próxima request retenta imediatamente.
 *
 * Header `X-Health-Cache: HIT|MISS` pra debugging.
 *
 * Auth: proxy.ts já valida JWT + session (AC1).
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/env";

interface CacheEntry {
  payload: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 5_000;
const FETCH_TIMEOUT_MS = 3_000;

let cache: CacheEntry | null = null;

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return NextResponse.json(cache.payload, {
      headers: {
        "X-Health-Cache": "HIT",
        "Cache-Control": "private, max-age=5",
      },
    });
  }

  if (!env.BACKEND_INTERNAL_URL) {
    return NextResponse.json(
      {
        status: "degraded",
        backend_unreachable: true,
        last_checked_at: new Date().toISOString(),
        error: "backend_internal_url_not_configured",
      },
      {
        status: 200,
        headers: { "X-Health-Cache": "MISS" },
      },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (env.BACKEND_INTERNAL_TOKEN) {
      headers.Authorization = `Bearer ${env.BACKEND_INTERNAL_TOKEN}`;
    }
    const upstream = await fetch(`${env.BACKEND_INTERNAL_URL}/health`, {
      signal: controller.signal,
      headers,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      throw new Error(`upstream_status_${upstream.status}`);
    }
    const payload: unknown = await upstream.json();
    cache = { payload, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(payload, {
      headers: {
        "X-Health-Cache": "MISS",
        "Cache-Control": "private, max-age=5",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    // NÃO cachear degraded — queremos retry imediato na próxima
    return NextResponse.json(
      {
        status: "degraded",
        backend_unreachable: true,
        last_checked_at: new Date().toISOString(),
        error: String(err instanceof Error ? err.message : err).slice(0, 200),
      },
      {
        status: 200,
        headers: { "X-Health-Cache": "MISS" },
      },
    );
  }
}
