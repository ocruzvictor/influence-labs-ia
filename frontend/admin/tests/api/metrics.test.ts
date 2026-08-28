/**
 * Integration tests — lib/metrics (getMetrics + getOverview) contra o schema real
 * (postgres-test: schema.sql + migration 001 com views + trinks_appointments).
 *
 * Cobre o que os unit tests não podem: que as 9 queries SQL EXECUTAM (não só
 * compilam) — pega page-500-on-first-load. Story 1.6 AC13-AC20.
 *
 * Pre-req: docker compose --profile test up -d postgres-test
 *          DATABASE_URL=postgres://postgres:test@localhost:5433/influence_labs_salon
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { query } from "../../lib/db";
import { getMetrics, getOverview } from "../../lib/metrics";
import { dbTest, isDbAvailable, insertMessage } from "./helpers";

async function resetTrinks(): Promise<void> {
  await query("TRUNCATE conversation_history RESTART IDENTITY CASCADE");
  await query("TRUNCATE trinks_appointments");
  await query("UPDATE trinks_sync_state SET last_success_at = NULL, consecutive_failures = 0, last_error = NULL WHERE id = 1");
}

async function insertAppt(o: {
  id: string;
  phone?: string | null;
  status: string;
  daysAgo?: number; // scheduled_at = hoje - daysAgo
  professional?: string;
}): Promise<void> {
  await query(
    `INSERT INTO trinks_appointments
       (trinks_id, client_phone, client_name, professional_id, professional_name,
        service_id, service_name, status, scheduled_at, raw)
     VALUES ($1,$2,'Cliente','1',$3,'10','Corte',$4, now() - ($5||' days')::interval, '{}'::jsonb)`,
    [o.id, o.phone ?? null, o.professional ?? "Tiago", o.status, o.daysAgo ?? 1],
  );
}

async function markSynced(): Promise<void> {
  await query("UPDATE trinks_sync_state SET last_success_at = now() WHERE id = 1");
}

// ─── Caminho populado ───────────────────────────────────────────────────
dbTest("getMetrics 7d — caminho populado executa e agrega corretamente", async () => {
  await resetTrinks();
  // conversas: 2 telefones, 1 com takeover humano
  await insertMessage({ phone: "5511964540007", role: "user" });
  await insertMessage({ phone: "5511964540007", role: "assistant", agent: "tirra" });
  await insertMessage({ phone: "5511999990000", role: "user" });
  await insertMessage({ phone: "5511999990000", role: "assistant", agent: "human" }); // takeover
  // agendamentos: telefone 007 tem agendamento (casa taxa de sucesso); status variados.
  // Telefones já normalizados COM 55 (= o que o worker grava via normalizePhoneBR).
  await insertAppt({ id: "a1", phone: "5511964540007", status: "completed", daysAgo: 1 });
  await insertAppt({ id: "a2", phone: "5511964540007", status: "no_show", daysAgo: 2 });
  await insertAppt({ id: "a3", phone: "5511933332222", status: "cancelled", daysAgo: 3 });
  await insertAppt({ id: "a4", phone: "5511933334444", status: "completed", daysAgo: 2, professional: "Carla" });
  await markSynced();

  const m = await getMetrics("7d", true);
  assert.equal(m.trinksAvailable, true);
  // agendamentos (created = confirmed+completed via view) = a1 + a4 = 2
  assert.equal(m.kpis.agendamentos.value, 2);
  assert.equal(m.kpis.noShows.value, 1); // a2
  assert.equal(m.kpis.cancelamentos.value, 1); // a3
  assert.equal(m.kpis.takeovers.value, 1); // phone 0000
  assert.ok((m.kpis.msgsDia.value ?? 0) >= 0);
  // no-show rate = 1 no_show / (1 + 2 completed) = 33.3
  assert.equal(m.noShowRatePct, 33.3);
  // taxa de sucesso: phone 007 conversou E tem agendamento; 0000 conversou sem agendamento → 50%
  assert.equal(m.kpis.taxaSucesso.value, 50);
  // série + top profissionais executam e voltam dados
  assert.ok(m.serieAgendamentos.length >= 1);
  assert.ok(m.topProfissionais && m.topProfissionais.length >= 1);
});

// ─── Empty-state (sync nunca rodou) ───────────────────────────────────────
dbTest("getMetrics 7d — empty-state: KPIs Trinks null, conversa preserva dados", async () => {
  await resetTrinks();
  await insertMessage({ phone: "5511964540007", role: "user" });
  await insertMessage({ phone: "5511964540007", role: "assistant", agent: "human" });
  // NÃO marca synced (last_success_at NULL) e trinks_appointments vazia

  const m = await getMetrics("7d", true);
  assert.equal(m.trinksAvailable, false);
  assert.equal(m.kpis.agendamentos.value, null);
  assert.equal(m.kpis.noShows.value, null);
  assert.equal(m.kpis.taxaSucesso.value, null);
  assert.equal(m.noShowRatePct, null);
  assert.equal(m.topProfissionais, null);
  // conversa segue com dados reais
  assert.equal(m.kpis.takeovers.value, 1);
  // telemetria operacional: null se tabela ausente (migration 010 não aplicada no test DB)
  assert.ok(m.kpis.handoffsHuman.value === null || typeof m.kpis.handoffsHuman.value === "number");
  assert.ok(m.kpis.bookingFailed.value === null || typeof m.kpis.bookingFailed.value === "number");
});

// ─── getOverview executa ──────────────────────────────────────────────────
dbTest("getOverview — executa e retorna KPIs da home", async () => {
  await resetTrinks();
  await insertMessage({ phone: "5511964540007", role: "user" });
  await insertAppt({ id: "b1", phone: "11964540007", status: "completed", daysAgo: 0 });
  await markSynced();

  const o = await getOverview(true);
  assert.equal(o.trinksAvailable, true);
  assert.equal(typeof o.kpis.conversasHoje.value, "number");
  assert.ok(o.kpis.agendamentosHoje !== null);
  assert.ok(o.kpis.noShowsSemana !== null);
  assert.equal(o.botAtivo, true); // seed migration 001: global = TRUE
});

// Probe informativo se DB ausente
test("integration metrics — DB disponível?", async () => {
  if (!(await isDbAvailable())) {
    console.log("ℹ️  postgres-test não acessível — testes de integração de métricas SKIPPED");
  }
});
