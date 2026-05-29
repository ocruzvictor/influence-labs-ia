const { test } = require('node:test');
const assert = require('node:assert');

const {
  mapStatus,
  normalizePhoneBR,
  valorToCents,
  mapAppointment,
} = require('../lib/trinks-mapping');

// ---- mapStatus (de-para confirmado na Fase 0) ----
test('mapStatus mapeia ids reais da Trinks', () => {
  assert.equal(mapStatus(4), 'confirmed');
  assert.equal(mapStatus(6), 'no_show'); // Cliente não compareceu
  assert.equal(mapStatus(8), 'completed');
  assert.equal(mapStatus(9), 'cancelled');
});
test('mapStatus → unknown para id não mapeado', () => {
  assert.equal(mapStatus(1), 'unknown');
  assert.equal(mapStatus(undefined), 'unknown');
  assert.equal(mapStatus(null), 'unknown');
});

// ---- normalizePhoneBR (Trinks 11 díg sem 55 ↔ conversation_history 13 díg com 55) ----
test('normalizePhoneBR prefixa 55 em DDD+número', () => {
  assert.equal(normalizePhoneBR('11964540007'), '5511964540007'); // 11 díg
  assert.equal(normalizePhoneBR('1133334444'), '551133334444'); // 10 díg (fixo)
});
test('normalizePhoneBR preserva número já com DDI 55', () => {
  assert.equal(normalizePhoneBR('5511964540007'), '5511964540007');
});
test('normalizePhoneBR limpa máscara', () => {
  assert.equal(normalizePhoneBR('(11) 96454-0007'), '5511964540007');
});
test('normalizePhoneBR → null quando insuficiente', () => {
  assert.equal(normalizePhoneBR('123'), null);
  assert.equal(normalizePhoneBR(''), null);
  assert.equal(normalizePhoneBR(null), null);
});
test('normalizePhoneBR → null quando longo demais (evita estourar VARCHAR(20))', () => {
  // cliente com 2 números no campo telefone → 20+ dígitos
  assert.equal(normalizePhoneBR('11999998888 / 1133334444'), null);
  assert.equal(normalizePhoneBR('5511999998888888888'), null); // 19 díg
  // garante que o resultado válido nunca passa de 13
  for (const v of ['11964540007', '1133334444', '5511964540007']) {
    const out = normalizePhoneBR(v);
    assert.ok(out === null || out.length <= 13, `${v} → ${out}`);
  }
});

// ---- valorToCents ----
test('valorToCents converte reais → centavos', () => {
  assert.equal(valorToCents(105), 10500);
  assert.equal(valorToCents(105.5), 10550);
  assert.equal(valorToCents(0), 0);
  assert.equal(valorToCents(null), null);
  assert.equal(valorToCents(-5), null);
});

// ---- mapAppointment ----
const REC = {
  id: 458020935,
  status: { id: 8, nome: 'Finalizado' },
  cliente: { id: 80035210, nome: 'Fulana' },
  servico: { id: 14232906, nome: 'Corte' },
  profissional: { id: 818965, nome: 'Tiago' },
  dataHoraInicio: '2026-05-28T19:30:00',
  duracaoEmMinutos: 30,
  valor: 105,
};

test('mapAppointment mapeia campos + injeta phone resolvido', () => {
  const row = mapAppointment(REC, '5511964540007');
  assert.equal(row.trinks_id, '458020935');
  assert.equal(row.client_trinks_id, '80035210');
  assert.equal(row.client_phone, '5511964540007');
  assert.equal(row.status, 'completed');
  assert.equal(row.scheduled_at, '2026-05-28T19:30:00');
  assert.equal(row.duration_min, 30);
  assert.equal(row.price_cents, 10500);
  assert.equal(row.created_at_trinks, null); // gap Fase 0
  assert.deepEqual(row.raw, REC);
});
test('mapAppointment → duration_min null quando duração 0 (CHECK > 0)', () => {
  assert.equal(mapAppointment({ ...REC, duracaoEmMinutos: 0 }, null).duration_min, null);
  assert.equal(mapAppointment({ ...REC, duracaoEmMinutos: -5 }, null).duration_min, null);
});
test('mapAppointment → null sem id ou dataHoraInicio', () => {
  assert.equal(mapAppointment({ dataHoraInicio: '2026-01-01T10:00:00' }), null);
  assert.equal(mapAppointment({ id: 1 }), null);
  assert.equal(mapAppointment(null), null);
});

// ---- worker: toTimestamptz / syncWindow / upsertChunk (mock db) ----
const db = require('../db');
const worker = require('../trinks-sync-worker');

test('toTimestamptz aplica offset BR a naive, preserva tz-aware', () => {
  assert.equal(worker.toTimestamptz('2026-05-28T19:30:00'), '2026-05-28T19:30:00-03:00');
  assert.equal(worker.toTimestamptz('2026-05-28T19:30:00-03:00'), '2026-05-28T19:30:00-03:00');
  assert.equal(worker.toTimestamptz('2026-05-28T22:30:00Z'), '2026-05-28T22:30:00Z');
});

test('syncWindow: backfill no 1º run, janela móvel depois', () => {
  assert.equal(worker.syncWindow(null).mode, 'backfill');
  assert.equal(worker.syncWindow({ last_success_at: null }).mode, 'backfill');
  assert.equal(worker.syncWindow({ last_success_at: '2026-05-01T00:00:00Z' }).mode, 'incremental');
});

test('upsertChunk monta UPSERT idempotente (ON CONFLICT + COALESCE phone)', async () => {
  const calls = [];
  const orig = db.query;
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rowCount: 1 };
  };
  try {
    const row = mapAppointment(REC, '5511964540007');
    const n = await worker.upsertChunk([row]);
    assert.equal(n, 1);
    assert.equal(calls.length, 1);
    const { sql, params } = calls[0];
    assert.match(sql, /INSERT INTO trinks_appointments/);
    assert.match(sql, /ON CONFLICT \(trinks_id\) DO UPDATE SET/);
    assert.match(sql, /client_phone = COALESCE\(EXCLUDED\.client_phone, trinks_appointments\.client_phone\)/);
    assert.match(sql, /synced_at = NOW\(\)/);
    assert.equal(params.length, worker.COLS.length); // 1 row × N cols
    // scheduled_at recebeu offset BR
    assert.ok(params.includes('2026-05-28T19:30:00-03:00'));
    // raw serializado como JSON string
    assert.ok(params.some((p) => typeof p === 'string' && p.includes('"id":458020935')));
  } finally {
    db.query = orig;
  }
});

test('upsertChunk vazio → 0 sem chamar db', async () => {
  const orig = db.query;
  let called = false;
  db.query = async () => { called = true; return {}; };
  try {
    assert.equal(await worker.upsertChunk([]), 0);
    assert.equal(called, false);
  } finally {
    db.query = orig;
  }
});
