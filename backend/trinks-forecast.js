#!/usr/bin/env node

const db = require('./db');
const { buildForecast } = require('./lib/trinks-forecast-model');

async function loadObserved() {
  const result = await db.query(
    `WITH daily_conversations AS (
       SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
              COUNT(DISTINCT client_phone) FILTER (WHERE role = 'user') AS clients
         FROM conversation_history
        WHERE created_at >= NOW() - INTERVAL '28 days'
        GROUP BY 1
     ), daily_appointments AS (
       SELECT (scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
              COUNT(*) AS appointments
         FROM trinks_appointments
        WHERE scheduled_at >= NOW() - INTERVAL '28 days'
          AND scheduled_at < NOW()
        GROUP BY 1
     )
     SELECT
       COALESCE((SELECT AVG(clients) FROM daily_conversations WHERE clients > 0), 0) AS avg_clients,
       COALESCE((SELECT AVG(appointments) FROM daily_appointments WHERE appointments > 0), 0) AS avg_appointments`,
  );
  const ledger = await db.query(
    `SELECT origin, method, endpoint,
            COUNT(*) FILTER (WHERE consumed)::int AS consumed,
            COUNT(*) FILTER (WHERE http_status = 429)::int AS rejected_429,
            COUNT(*)::int AS attempts
       FROM trinks_api_requests
      WHERE requested_at >= NOW() - INTERVAL '28 days'
      GROUP BY origin, method, endpoint
      ORDER BY consumed DESC, attempts DESC`,
  );
  const mutations = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE origin = 'agent_mutation_create')::int AS creates,
       COUNT(*) FILTER (WHERE origin = 'agent_mutation_cancel')::int AS cancels,
       COUNT(*) FILTER (WHERE origin = 'agent_mutation_reschedule')::int AS reschedules,
       COUNT(*) FILTER (WHERE origin = 'agent_mutation_create_client')::int AS new_clients,
       COUNT(*) FILTER (WHERE origin = 'daily_reconcile')::int AS reconcile_pages,
       COUNT(*) FILTER (WHERE origin = 'slot_outside_snapshot')::int AS outside_snapshot
     FROM trinks_api_requests
     WHERE consumed
       AND requested_at >= NOW() - INTERVAL '28 days'`,
  );
  const row = result?.rows?.[0] || {};
  const flows = mutations?.rows?.[0] || {};
  return {
    window_days: 28,
    dataAvailable: Boolean(
      result
      && (Number(row.avg_clients || 0) > 0
        || Number(row.avg_appointments || 0) > 0
        || (ledger?.rows?.length || 0) > 0)
    ),
    avgDailyClients: Number(row.avg_clients || 0),
    avgDailyAppointments: Number(row.avg_appointments || 0),
    creations: Number(flows.creates || 0),
    cancellations: Number(flows.cancels || 0),
    reschedules: Number(flows.reschedules || 0),
    newClients: Number(flows.new_clients || 0),
    reconcilePages: Number(flows.reconcile_pages || 0),
    outsideSnapshotQueries: Number(flows.outside_snapshot || 0),
    byOriginEndpoint: ledger?.rows || [],
  };
}

function numericArg(name) {
  const prefix = `--${name}=`;
  const item = process.argv.find(value => value.startsWith(prefix));
  if (!item) return null;
  const value = Number(item.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function printHuman(report) {
  console.log('Trinks REST forecast (28d baseline)');
  console.log(`Budget: ${report.assumptions.monthlyBudget} | operational cap: ${report.assumptions.operationalCap}`);
  for (const s of report.scenarios) {
    console.log(
      `${s.name.padEnd(12)} ${String(s.projected_requests).padStart(5)} req/month `
      + `(${s.within_operational_cap ? 'within cap' : 'circuit breaker'})`,
    );
  }
  console.log(`Gates: ${report.pass ? 'PASS' : 'FAIL'}`);
}

async function main() {
  const observed = await loadObserved();
  const avgClientsOverride = numericArg('avg-clients');
  const avgAppointmentsOverride = numericArg('avg-appointments');
  if (avgClientsOverride && avgAppointmentsOverride) {
    observed.avgDailyClients = avgClientsOverride;
    observed.avgDailyAppointments = avgAppointmentsOverride;
    observed.dataAvailable = true;
    observed.source = 'explicit_28d_baseline';
  } else {
    observed.source = observed.dataAvailable ? 'database_28d' : 'unavailable';
  }
  const report = buildForecast(observed, {
    monthlyBudget: Number(process.env.TRINKS_MONTHLY_BUDGET || 10000),
    operationalCap: Number(process.env.TRINKS_OPERATIONAL_CAP || 8500),
    reconcilePagesPerDay: Number(process.env.TRINKS_RECONCILE_PAGES || 17),
  });
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  if (!report.pass) process.exitCode = 1;
}

main().catch(err => {
  console.error(`forecast failed: ${err.message}`);
  process.exitCode = 1;
});
