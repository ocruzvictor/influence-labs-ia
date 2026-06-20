const db = require('./db');
const { createTrinksApi } = require('./lib/trinks-api');
const { createTrinksLocalStore } = require('./lib/trinks-local-store');
const { mapAppointment, valorToCents } = require('./lib/trinks-mapping');

const INTERVAL_MIN = Number(process.env.TRINKS_RECONCILE_INTERVAL_MIN || 1440);
const PAGE_DELAY_MS = Number(process.env.TRINKS_PAGE_DELAY_MS || 1500);
const SNAPSHOT_DAYS = Number(process.env.TRINKS_SLOT_SNAPSHOT_DAYS || 7);
const CATALOG_MAX_AGE_DAYS = Number(process.env.TRINKS_CATALOG_MAX_AGE_DAYS || 7);
const TZ_OFFSET = '-03:00';

let api = null;
function getApi() {
  if (!api) {
    api = createTrinksApi({
      db,
      baseUrl: process.env.TRINKS_API_BASE || 'https://api.trinks.com/v1',
      apiKey: process.env.TRINKS_API_KEY,
      establishmentId: process.env.TRINKS_ESTABELECIMENTO_ID,
      budget: Number(process.env.TRINKS_MONTHLY_BUDGET || 10000),
      operationalCap: Number(process.env.TRINKS_OPERATIONAL_CAP || 8500),
    });
  }
  return api;
}
const store = createTrinksLocalStore(db);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = (msg, extra = {}) => console.log(JSON.stringify({
  t: new Date().toISOString(),
  worker: 'trinks-state',
  msg,
  ...extra,
}));

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function nextBusinessDates(count, now = new Date()) {
  const dates = [];
  let cursor = new Date(`${isoDate(now)}T12:00:00Z`);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 1) dates.push(isoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function mapSlots(date, payload) {
  const rows = [];
  for (const professional of Array.isArray(payload?.data) ? payload.data : []) {
    for (const time of professional.horariosVagos || []) {
      rows.push({
        professionalId: professional.id,
        startsAt: `${date}T${time}:00${TZ_OFFSET}`,
        available: true,
        raw: { date, time, professional },
      });
    }
  }
  return rows;
}

async function catalogNeedsRefresh() {
  const result = await db.query(
    `SELECT MAX(synced_at) AS synced_at FROM trinks_service_professionals`,
  );
  const last = result?.rows?.[0]?.synced_at;
  return !last || Date.now() - new Date(last).getTime() >= CATALOG_MAX_AGE_DAYS * 86400000;
}

async function syncCatalog() {
  if (!(await catalogNeedsRefresh())) return { skipped: true };
  const professionalsPayload = await getApi().request('/profissionais', { origin: 'catalog_snapshot' });
  await sleep(PAGE_DELAY_MS);
  const servicesPayload = await getApi().request('/servicos', { origin: 'catalog_snapshot' });
  const professionals = Array.isArray(professionalsPayload.data) ? professionalsPayload.data : [];
  const services = Array.isArray(servicesPayload.data) ? servicesPayload.data : [];

  for (const professional of professionals) {
    await store.upsertProfessional({
      trinksId: professional.id,
      name: professional.nome,
      nickname: professional.apelido,
      active: professional.ativo !== false,
      raw: professional,
    });
  }
  for (const service of services) {
    await store.upsertService({
      trinksId: service.id,
      name: service.nome,
      durationMin: service.duracaoEmMinutos,
      priceCents: valorToCents(service.preco),
      active: service.visivelParaCliente !== false,
      raw: service,
    });
  }

  let pairs = 0;
  const compatibilities = [];
  for (const professional of professionals) {
    await sleep(PAGE_DELAY_MS);
    const payload = await getApi().request(`/profissionais/${professional.id}/servicos`, {
      origin: 'compatibility_snapshot',
    });
    for (const service of Array.isArray(payload.data) ? payload.data : []) {
      compatibilities.push({
        serviceId: service.id,
        professionalId: professional.id,
        active: true,
        raw: service,
      });
      pairs++;
    }
  }
  await store.replaceCompatibilitySnapshot(compatibilities);
  return { professionals: professionals.length, services: services.length, pairs };
}

async function syncSlots() {
  let count = 0;
  for (const date of nextBusinessDates(SNAPSHOT_DAYS)) {
    const payload = await getApi().request(`/agendamentos/profissionais/${date}`, {
      origin: 'slot_snapshot',
    });
    const rows = mapSlots(date, payload);
    await store.replaceSlotsForDate(date, rows);
    count += rows.length;
    await sleep(PAGE_DELAY_MS);
  }
  return { dates: SNAPSHOT_DAYS, slots: count };
}

async function reconcileAppointments() {
  const now = new Date();
  const dataInicio = isoDate(addDays(now, -3));
  const dataFim = isoDate(addDays(now, 30));
  let page = 1;
  let totalPages = 1;
  let synced = 0;
  do {
    const path = `/agendamentos?dataInicio=${dataInicio}&dataFim=${dataFim}&page=${page}`;
    let payload;
    try {
      payload = await getApi().request(path, { origin: 'daily_reconcile' });
    } catch (err) {
      if (err.status === 429) {
        log('reconcile_rate_limited', { page, synced });
        return { partial: true, page, synced, error: err.message };
      }
      throw err;
    }
    totalPages = Number(payload.totalPages || 1);
    for (const record of Array.isArray(payload.data) ? payload.data : []) {
      const localClient = record.cliente?.id == null
        ? null
        : await store.getClientByTrinksId(record.cliente.id);
      const mapped = mapAppointment(record, localClient?.phone || null);
      if (!mapped) continue;
      await store.upsertAppointment({
        trinksId: mapped.trinks_id,
        clientTrinksId: mapped.client_trinks_id,
        clientPhone: mapped.client_phone,
        clientName: mapped.client_name,
        professionalId: mapped.professional_id,
        professionalName: mapped.professional_name,
        serviceId: mapped.service_id,
        serviceName: mapped.service_name,
        status: mapped.status,
        scheduledAt: mapped.scheduled_at,
        durationMin: mapped.duration_min,
        priceCents: mapped.price_cents,
        updatedAtTrinks: mapped.updated_at_trinks,
        raw: record,
      });
      synced++;
    }
    await db.query('UPDATE trinks_sync_state SET last_sync_at = NOW() WHERE id = 1');
    page++;
    if (page <= totalPages) await sleep(PAGE_DELAY_MS);
  } while (page <= totalPages);
  return { partial: false, pages: totalPages, synced };
}

async function runCycle() {
  log('cycle_start');
  try {
    const consumption = await getApi().refreshConsumption();
    const catalog = await syncCatalog();
    const slots = await syncSlots();
    const reconcile = await reconcileAppointments();
    await db.query(
      `UPDATE trinks_sync_state
          SET last_success_at = CASE WHEN $1 THEN last_success_at ELSE NOW() END,
              consecutive_failures = CASE WHEN $1 THEN consecutive_failures + 1 ELSE 0 END,
              last_error = CASE WHEN $1 THEN $2 ELSE NULL END,
              records_synced_total = records_synced_total + $3
        WHERE id = 1`,
      [reconcile.partial, reconcile.error || null, reconcile.synced || 0],
    );
    log('cycle_complete', { consumption, catalog, slots, reconcile });
  } catch (err) {
    await db.query(
      `UPDATE trinks_sync_state
          SET last_sync_at = NOW(),
              consecutive_failures = consecutive_failures + 1,
              last_error = $1
        WHERE id = 1`,
      [String(err.message).slice(0, 500)],
    );
    log('cycle_error', { error: err.message });
  }
}

async function main() {
  await runCycle();
  setInterval(() => runCycle().catch(err => log('cycle_unhandled', { error: err.message })), INTERVAL_MIN * 60000);
}

if (require.main === module) {
  main().catch(err => {
    log('fatal', { error: err.message });
    process.exit(1);
  });
}

module.exports = {
  nextBusinessDates,
  mapSlots,
  syncCatalog,
  syncSlots,
  reconcileAppointments,
  runCycle,
};
