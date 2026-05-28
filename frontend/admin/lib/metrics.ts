/**
 * Métricas do dashboard (Story 1.6).
 *
 * Bases temporais (AC14-BASE, fixadas após a Fase 0 — a API Trinks NÃO expõe data
 * de criação do booking, só dataHoraInicio = scheduled_at):
 *   • KPIs de agendamento (agendamentos/no-show/cancelamento) + série diária + top
 *     profissionais → base `scheduled_at`, reusando a view `v_admin_appointments_daily`
 *     (migration 001) que já bucketiza por DATE(scheduled_at AT TIME ZONE São Paulo).
 *   • KPIs de conversa (conversas atendidas, msgs/dia, takeovers) → `conversation_history`
 *     direto com janela em `created_at`. NÃO usar v_admin_conversations_summary (lifetime).
 *   • Taxa de sucesso do bot → join heurístico por telefone normalizado.
 *
 * Empty-state (AC19): se o sync nunca rodou / tabela vazia, KPIs Trinks retornam null
 * (não 0) — a UI mostra "Aguardando primeiro sync Trinks".
 *
 * Cache LRU 60s por chave (arch §9.2). Refresh manual faz bypass.
 */

import { LRUCache } from "lru-cache";
import { query } from "./db";

export type Period = "24h" | "7d" | "30d" | "90d";

const DAYS: Record<Period, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };

export interface Trend {
  delta: number; // valor atual − anterior (absoluto)
  pct: number | null; // variação percentual (null se anterior = 0)
}

export interface Kpi {
  value: number | null;
  trend: Trend | null;
}

export interface SyncStatus {
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
}

export interface MetricsResult {
  period: Period;
  trinksAvailable: boolean;
  syncStatus: SyncStatus;
  kpis: {
    agendamentos: Kpi;
    taxaSucesso: Kpi; // value = % 0-100 ou null
    takeovers: Kpi;
    noShows: Kpi;
    cancelamentos: Kpi;
    msgsDia: Kpi; // média por dia
  };
  noShowRatePct: number | null;
  serieAgendamentos: Array<{ day: string; created: number; cancelled: number; no_shows: number }>;
  topProfissionais: Array<{ professional_name: string; count: number }> | null;
}

export interface OverviewResult {
  trinksAvailable: boolean;
  botAtivo: boolean | null;
  syncStatus: SyncStatus;
  kpis: {
    conversasHoje: Kpi;
    agendamentosHoje: Kpi | null;
    noShowsSemana: Kpi | null;
  };
}

const cache = new LRUCache<string, MetricsResult | OverviewResult>({ max: 50, ttl: 60_000 });

const toInt = (v: unknown): number =>
  v == null ? 0 : typeof v === "string" ? parseInt(v, 10) || 0 : Number(v) || 0;

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function trend(current: number, previous: number): Trend {
  return { delta: current - previous, pct: previous === 0 ? null : ((current - previous) / previous) * 100 };
}

// ─── Agregados de agendamentos (base scheduled_at via view) ───────────────

interface ApptAgg {
  created: number;
  cancelled: number;
  no_shows: number;
  completed: number;
}

/** Soma a view por intervalo de dias [hoje-offsetEnd, hoje-offsetStart] (TZ São Paulo). */
async function apptAgg(daysBack: number, daysBackEnd = 0): Promise<ApptAgg> {
  const rows = await query<{ created: string; cancelled: string; no_shows: string; completed: string }>(
    `SELECT COALESCE(SUM(created),0) created, COALESCE(SUM(cancelled),0) cancelled,
            COALESCE(SUM(no_shows),0) no_shows, COALESCE(SUM(completed),0) completed
       FROM v_admin_appointments_daily
      WHERE day >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - $1::int)
        AND day <  ((now() AT TIME ZONE 'America/Sao_Paulo')::date - $2::int + 1)`,
    [daysBack, daysBackEnd],
  );
  const r = rows[0] ?? { created: "0", cancelled: "0", no_shows: "0", completed: "0" };
  return { created: toInt(r.created), cancelled: toInt(r.cancelled), no_shows: toInt(r.no_shows), completed: toInt(r.completed) };
}

// ─── Agregados de conversa (base created_at, janela rolante) ──────────────

interface ConvAgg {
  conversas: number; // distinct phones
  mensagens: number; // total msgs
  takeovers: number; // distinct phones com agent='human'
}

async function convAgg(days: number, offsetDays = 0): Promise<ConvAgg> {
  const rows = await query<{ conversas: string; mensagens: string; takeovers: string }>(
    `SELECT COUNT(DISTINCT client_phone) conversas,
            COUNT(*) mensagens,
            COUNT(DISTINCT client_phone) FILTER (WHERE agent = 'human') takeovers
       FROM conversation_history
      WHERE created_at >= now() - (($1::int + $2::int) || ' days')::interval
        AND created_at <  now() - ($2::int || ' days')::interval`,
    [days, offsetDays],
  );
  const r = rows[0] ?? { conversas: "0", mensagens: "0", takeovers: "0" };
  return { conversas: toInt(r.conversas), mensagens: toInt(r.mensagens), takeovers: toInt(r.takeovers) };
}

// ─── Sync status + disponibilidade Trinks ─────────────────────────────────

async function syncStatusAndAvail(): Promise<{ status: SyncStatus; available: boolean }> {
  const rows = await query<{
    last_success_at: Date | null;
    consecutive_failures: string | number;
    last_error: string | null;
    has_data: boolean;
  }>(
    `SELECT s.last_success_at, s.consecutive_failures, s.last_error,
            EXISTS(SELECT 1 FROM trinks_appointments LIMIT 1) AS has_data
       FROM trinks_sync_state s WHERE s.id = 1`,
  );
  const r = rows[0];
  const status: SyncStatus = {
    lastSuccessAt: r?.last_success_at ? new Date(r.last_success_at).toISOString() : null,
    consecutiveFailures: toInt(r?.consecutive_failures),
    lastError: r?.last_error ?? null,
  };
  // Disponível só quando o sync já teve sucesso E há dados.
  const available = Boolean(r?.has_data) && status.lastSuccessAt !== null;
  return { status, available };
}

// ─── Taxa de sucesso do bot (heurística — join por telefone normalizado) ──

/**
 * % de telefones distintos com conversa na janela que TÊM ≥1 agendamento
 * (scheduled_at na janela) — match por dígitos do telefone (ambos os lados).
 * Heurística de atribuição (não prova causalidade). null se sem dados Trinks.
 */
async function taxaSucesso(days: number, offsetDays: number, available: boolean): Promise<number | null> {
  if (!available) return null;
  const rows = await query<{ pct: string | null }>(
    `WITH conv AS (
        SELECT DISTINCT regexp_replace(client_phone, '\\D', '', 'g') AS ph
          FROM conversation_history
         WHERE created_at >= now() - (($1::int + $2::int) || ' days')::interval
           AND created_at <  now() - ($2::int || ' days')::interval
           AND client_phone IS NOT NULL
     ),
     appt AS (
        SELECT DISTINCT regexp_replace(client_phone, '\\D', '', 'g') AS ph
          FROM trinks_appointments
         WHERE client_phone IS NOT NULL
           AND status <> 'cancelled'
           AND scheduled_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - ($1::int + $2::int))
           AND scheduled_at <  ((now() AT TIME ZONE 'America/Sao_Paulo')::date - $2::int + 1)
     )
     SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE appt.ph IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS pct
       FROM conv LEFT JOIN appt USING (ph)`,
    [days, offsetDays],
  );
  return toNum(rows[0]?.pct ?? null);
}

// ─── getMetrics ───────────────────────────────────────────────────────────

export async function getMetrics(period: Period, fresh = false): Promise<MetricsResult> {
  const key = `metrics:${period}`;
  if (!fresh) {
    const cached = cache.get(key);
    if (cached) return cached as MetricsResult;
  }

  const days = DAYS[period];
  const { status: syncStatus, available } = await syncStatusAndAvail();

  // Conversa: atual + anterior (sempre disponível)
  const [convNow, convPrev] = await Promise.all([convAgg(days, 0), convAgg(days, days)]);

  // Agendamento: atual + anterior (só se Trinks disponível)
  let apptNow: ApptAgg = { created: 0, cancelled: 0, no_shows: 0, completed: 0 };
  let apptPrev = apptNow;
  let serie: MetricsResult["serieAgendamentos"] = [];
  let topProf: MetricsResult["topProfissionais"] = null;
  let taxa: number | null = null;
  let taxaPrev: number | null = null;

  if (available) {
    [apptNow, apptPrev] = await Promise.all([apptAgg(days, 0), apptAgg(days * 2, days)]);
    [taxa, taxaPrev] = await Promise.all([
      taxaSucesso(days, 0, available),
      taxaSucesso(days, days, available),
    ]);
    const serieRows = await query<{ day: Date; created: string; cancelled: string; no_shows: string }>(
      `SELECT day, created, cancelled, no_shows
         FROM v_admin_appointments_daily
        WHERE day >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - $1::int)
          AND day <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
        ORDER BY day ASC`,
      [days],
    );
    serie = serieRows.map((r) => ({
      day: new Date(r.day).toISOString().slice(0, 10),
      created: toInt(r.created),
      cancelled: toInt(r.cancelled),
      no_shows: toInt(r.no_shows),
    }));
    const profRows = await query<{ professional_name: string | null; count: string }>(
      `SELECT professional_name, COUNT(*) count
         FROM trinks_appointments
        WHERE status <> 'cancelled'
          AND professional_name IS NOT NULL
          AND scheduled_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - $1::int)
          AND scheduled_at <= ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1)
        GROUP BY professional_name
        ORDER BY count DESC
        LIMIT 10`,
      [days],
    );
    topProf = profRows.map((r) => ({ professional_name: r.professional_name ?? "—", count: toInt(r.count) }));
  }

  const result = assembleMetrics({
    period, days, available, syncStatus,
    convNow, convPrev, apptNow, apptPrev, taxa, taxaPrev, serie, topProf,
  });
  cache.set(key, result);
  return result;
}

/** Montagem pura do MetricsResult (sem I/O) — testável com fixtures. */
function assembleMetrics(a: {
  period: Period;
  days: number;
  available: boolean;
  syncStatus: SyncStatus;
  convNow: ConvAgg;
  convPrev: ConvAgg;
  apptNow: ApptAgg;
  apptPrev: ApptAgg;
  taxa: number | null;
  taxaPrev: number | null;
  serie: MetricsResult["serieAgendamentos"];
  topProf: MetricsResult["topProfissionais"];
}): MetricsResult {
  const nullKpi: Kpi = { value: null, trend: null };
  const msgsNow = Math.round(a.convNow.mensagens / a.days);
  const msgsPrev = Math.round(a.convPrev.mensagens / a.days);
  const noShowRate =
    !a.available || a.apptNow.no_shows + a.apptNow.completed === 0
      ? null
      : Math.round((1000 * a.apptNow.no_shows) / (a.apptNow.no_shows + a.apptNow.completed)) / 10;

  return {
    period: a.period,
    trinksAvailable: a.available,
    syncStatus: a.syncStatus,
    kpis: {
      agendamentos: a.available ? { value: a.apptNow.created, trend: trend(a.apptNow.created, a.apptPrev.created) } : nullKpi,
      taxaSucesso:
        a.available && a.taxa !== null
          ? { value: a.taxa, trend: a.taxaPrev !== null ? trend(a.taxa, a.taxaPrev) : null }
          : nullKpi,
      takeovers: { value: a.convNow.takeovers, trend: trend(a.convNow.takeovers, a.convPrev.takeovers) },
      noShows: a.available ? { value: a.apptNow.no_shows, trend: trend(a.apptNow.no_shows, a.apptPrev.no_shows) } : nullKpi,
      cancelamentos: a.available ? { value: a.apptNow.cancelled, trend: trend(a.apptNow.cancelled, a.apptPrev.cancelled) } : nullKpi,
      msgsDia: { value: msgsNow, trend: trend(msgsNow, msgsPrev) },
    },
    noShowRatePct: noShowRate,
    serieAgendamentos: a.serie,
    topProfissionais: a.topProf,
  };
}

/** Exposto só para testes (node:test). */
export const __test = { trend, assembleMetrics };

// ─── getOverview (home / Tela 2) ───────────────────────────────────────────

export async function getOverview(fresh = false): Promise<OverviewResult> {
  const key = "overview";
  if (!fresh) {
    const cached = cache.get(key);
    if (cached) return cached as OverviewResult;
  }

  const { status: syncStatus, available } = await syncStatusAndAvail();

  // Conversas hoje (dia SP) atual + ontem
  const convRows = await query<{ hoje: string; ontem: string }>(
    `SELECT
       COUNT(DISTINCT client_phone) FILTER (
         WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date) hoje,
       COUNT(DISTINCT client_phone) FILTER (
         WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1) ontem
       FROM conversation_history
      WHERE created_at >= now() - interval '2 days'`,
  );
  const conv = convRows[0] ?? { hoje: "0", ontem: "0" };

  // Bot ativo (toggle global)
  const botRows = await query<{ enabled: boolean }>(
    `SELECT enabled FROM bot_toggles WHERE key = 'global'`,
  );
  const botAtivo = botRows[0]?.enabled ?? null;

  let agHoje: Kpi | null = null;
  let nsSemana: Kpi | null = null;
  if (available) {
    const apHoje = await apptAgg(0, 0); // só hoje
    const apOntem = await apptAgg(1, 1); // só ontem
    agHoje = { value: apHoje.created, trend: trend(apHoje.created, apOntem.created) };
    const ns7 = await apptAgg(7, 0);
    const ns7prev = await apptAgg(14, 7);
    nsSemana = { value: ns7.no_shows, trend: trend(ns7.no_shows, ns7prev.no_shows) };
  }

  const result: OverviewResult = {
    trinksAvailable: available,
    botAtivo,
    syncStatus,
    kpis: {
      conversasHoje: { value: toInt(conv.hoje), trend: trend(toInt(conv.hoje), toInt(conv.ontem)) },
      agendamentosHoje: agHoje,
      noShowsSemana: nsSemana,
    },
  };

  cache.set(key, result);
  return result;
}
