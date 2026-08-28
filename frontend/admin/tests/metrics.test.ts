/**
 * Tests para lib/metrics.ts — funções puras trend() e assembleMetrics().
 * Story 1.6 AC35: agregação + trend + dataset vazio → null (não 0).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { __test, type SyncStatus } from "../lib/metrics";

const { trend, assembleMetrics } = __test;

const SYNC_OK: SyncStatus = { lastSuccessAt: "2026-05-28T12:00:00.000Z", consecutiveFailures: 0, lastError: null };

const OP_NULL = { handoffs: null as number | null, bookingFailed: null as number | null };

// ─── trend ───
test("trend calcula delta e pct", () => {
  assert.deepEqual(trend(10, 8), { delta: 2, pct: 25 });
  assert.deepEqual(trend(8, 10), { delta: -2, pct: -20 });
});
test("trend com anterior 0 → pct null (sem divisão por zero)", () => {
  assert.deepEqual(trend(5, 0), { delta: 5, pct: null });
});
test("trend estável", () => {
  assert.deepEqual(trend(7, 7), { delta: 0, pct: 0 });
});

// ─── assembleMetrics: Trinks indisponível → KPIs Trinks null, conversa presente ───
test("assembleMetrics sem Trinks → KPIs de agendamento null, conversa com dados", () => {
  const r = assembleMetrics({
    period: "7d",
    days: 7,
    available: false,
    syncStatus: { lastSuccessAt: null, consecutiveFailures: 0, lastError: null },
    convNow: { conversas: 20, mensagens: 140, takeovers: 3 },
    convPrev: { conversas: 18, mensagens: 126, takeovers: 5 },
    apptNow: { created: 0, cancelled: 0, no_shows: 0, completed: 0 },
    apptPrev: { created: 0, cancelled: 0, no_shows: 0, completed: 0 },
    taxa: null,
    taxaPrev: null,
    serie: [],
    topProf: null,
    opNow: OP_NULL,
    opPrev: OP_NULL,
  });
  assert.equal(r.trinksAvailable, false);
  // Trinks KPIs → null (não 0)
  assert.equal(r.kpis.agendamentos.value, null);
  assert.equal(r.kpis.noShows.value, null);
  assert.equal(r.kpis.cancelamentos.value, null);
  assert.equal(r.kpis.taxaSucesso.value, null);
  assert.equal(r.noShowRatePct, null);
  assert.equal(r.topProfissionais, null);
  // Conversa KPIs → reais
  assert.equal(r.kpis.takeovers.value, 3);
  assert.equal(r.kpis.msgsDia.value, 20); // 140/7
  assert.deepEqual(r.kpis.takeovers.trend, { delta: -2, pct: -40 });
  assert.equal(r.kpis.handoffsHuman.value, null);
  assert.equal(r.kpis.bookingFailed.value, null);
});

// ─── assembleMetrics: Trinks disponível → KPIs + noShowRate ───
test("assembleMetrics com Trinks → valores e taxa de no-show", () => {
  const r = assembleMetrics({
    period: "30d",
    days: 30,
    available: true,
    syncStatus: SYNC_OK,
    convNow: { conversas: 50, mensagens: 600, takeovers: 4 },
    convPrev: { conversas: 40, mensagens: 600, takeovers: 4 },
    apptNow: { created: 47, cancelled: 8, no_shows: 3, completed: 44 },
    apptPrev: { created: 38, cancelled: 10, no_shows: 5, completed: 33 },
    taxa: 68,
    taxaPrev: 64,
    serie: [{ day: "2026-05-01", created: 5, cancelled: 1, no_shows: 0 }],
    topProf: [{ professional_name: "Tiago", count: 18 }],
    opNow: { handoffs: 5, bookingFailed: 2 },
    opPrev: { handoffs: 3, bookingFailed: 4 },
  });
  assert.equal(r.kpis.agendamentos.value, 47);
  assert.deepEqual(r.kpis.agendamentos.trend, { delta: 9, pct: (9 / 38) * 100 });
  assert.equal(r.kpis.taxaSucesso.value, 68);
  assert.deepEqual(r.kpis.taxaSucesso.trend, { delta: 4, pct: (4 / 64) * 100 });
  // no_show_rate = 3 / (3+44) = 6.38% → arredonda 1 casa = 6.4
  assert.equal(r.noShowRatePct, 6.4);
  assert.equal(r.kpis.msgsDia.value, 20); // 600/30
  assert.deepEqual(r.kpis.msgsDia.trend, { delta: 0, pct: 0 });
  assert.equal(r.kpis.handoffsHuman.value, 5);
  assert.deepEqual(r.kpis.handoffsHuman.trend, { delta: 2, pct: (2 / 3) * 100 });
  assert.equal(r.kpis.bookingFailed.value, 2);
  assert.deepEqual(r.kpis.bookingFailed.trend, { delta: -2, pct: -50 });
  assert.equal(r.topProfissionais?.[0]?.count, 18);
});

// ─── taxa de sucesso null mesmo com Trinks disponível (sem conversa casada) ───
test("assembleMetrics: taxa null vira KPI null mesmo com Trinks disponível", () => {
  const r = assembleMetrics({
    period: "7d", days: 7, available: true, syncStatus: SYNC_OK,
    convNow: { conversas: 0, mensagens: 0, takeovers: 0 },
    convPrev: { conversas: 0, mensagens: 0, takeovers: 0 },
    apptNow: { created: 1, cancelled: 0, no_shows: 0, completed: 1 },
    apptPrev: { created: 0, cancelled: 0, no_shows: 0, completed: 0 },
    taxa: null, taxaPrev: null, serie: [], topProf: [],
    opNow: OP_NULL,
    opPrev: OP_NULL,
  });
  assert.equal(r.kpis.taxaSucesso.value, null);
  assert.equal(r.kpis.agendamentos.value, 1);
});
