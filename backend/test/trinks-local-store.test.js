const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTrinksLocalStore } = require('../lib/trinks-local-store');

function mockDb(responses = []) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      return responses.length ? responses.shift() : { rows: [] };
    },
  };
}

test('requires a db query function', () => {
  assert.throws(() => createTrinksLocalStore(), /db\.query is required/);
  assert.throws(() => createTrinksLocalStore({}), /db\.query is required/);
});

test('reads professionals and services with active filters', async () => {
  const db = mockDb([
    { rows: [{ trinks_id: '10', name: 'Ana' }] },
    { rows: [{ trinks_id: '20', name: 'Corte' }] },
  ]);
  const store = createTrinksLocalStore(db);

  assert.deepEqual(await store.listProfessionals(), [{ trinks_id: '10', name: 'Ana' }]);
  assert.deepEqual(await store.listServices({ activeOnly: false }), [
    { trinks_id: '20', name: 'Corte' },
  ]);

  assert.match(db.calls[0].sql, /FROM trinks_professionals/);
  assert.match(db.calls[0].sql, /deleted_at IS NULL/);
  assert.deepEqual(db.calls[0].params, [true]);
  assert.match(db.calls[1].sql, /FROM trinks_services/);
  assert.deepEqual(db.calls[1].params, [false]);
});

test('upserts professional and service snapshots with JSON payloads', async () => {
  const db = mockDb([
    { rows: [{ trinks_id: '10' }] },
    { rows: [{ trinks_id: '20' }] },
  ]);
  const store = createTrinksLocalStore(db);

  await store.upsertProfessional({
    trinksId: 10,
    name: 'Ana',
    nickname: 'Aninha',
    raw: { id: 10 },
  });
  await store.upsertService({
    trinksId: 20,
    name: 'Corte',
    durationMin: 45,
    priceCents: 9000,
    active: false,
    raw: { id: 20 },
  });

  assert.match(db.calls[0].sql, /INSERT INTO trinks_professionals/);
  assert.match(db.calls[0].sql, /ON CONFLICT \(trinks_id\) DO UPDATE/);
  assert.deepEqual(db.calls[0].params.slice(0, 5), [
    '10',
    'Ana',
    'Aninha',
    true,
    '{"id":10}',
  ]);
  assert.match(db.calls[1].sql, /INSERT INTO trinks_services/);
  assert.deepEqual(db.calls[1].params.slice(0, 6), [
    '20',
    'Corte',
    45,
    9000,
    false,
    '{"id":20}',
  ]);
});

test('reads, checks and upserts service-professional compatibility', async () => {
  const db = mockDb([
    { rows: [{ service_id: '20', professional_id: '10', active: true }] },
    { rows: [{ compatible: true }] },
    { rows: [{ service_id: '20', professional_id: '10' }] },
  ]);
  const store = createTrinksLocalStore(db);

  const rows = await store.listCompatibility({ serviceId: 20, professionalId: 10 });
  assert.equal(rows.length, 1);
  assert.equal(await store.isCompatible(20, 10), true);
  await store.upsertCompatibility({
    serviceId: 20,
    professionalId: 10,
    raw: { source: 'reconcile' },
  });

  assert.deepEqual(db.calls[0].params, ['20', '10', true]);
  assert.match(db.calls[1].sql, /SELECT \(/);
  assert.match(db.calls[1].sql, /trinks_appointments/);
  assert.deepEqual(db.calls[1].params, ['20', '10', '90']);
  assert.match(db.calls[2].sql, /ON CONFLICT \(service_id, professional_id\)/);
  assert.deepEqual(db.calls[2].params.slice(0, 4), [
    '20',
    '10',
    true,
    '{"source":"reconcile"}',
  ]);
});

test('listObservedServiceProfessionals reads appointment pairs', async () => {
  const db = mockDb([
    { rows: [{ service_id: '20', professional_id: '10', professional_name: 'Giovanna' }] },
  ]);
  const store = createTrinksLocalStore(db);
  const rows = await store.listObservedServiceProfessionals({ sinceDays: 90 });
  assert.equal(rows.length, 1);
  assert.match(db.calls[0].sql, /FROM trinks_appointments/);
  assert.deepEqual(db.calls[0].params, ['90']);
});

test('reads compatible available slots and upserts a slot', async () => {
  const db = mockDb([
    { rows: [{ professional_id: '10', starts_at: '2026-06-20T12:00:00Z' }] },
    { rows: [{ professional_id: '10' }] },
  ]);
  const store = createTrinksLocalStore(db);

  const slots = await store.listSlots({
    from: '2026-06-20T00:00:00-03:00',
    to: '2026-06-21T00:00:00-03:00',
    professionalId: 10,
    serviceId: 20,
  });
  assert.equal(slots.length, 1);
  await store.upsertSlot({
    professionalId: 10,
    startsAt: '2026-06-20T09:00:00-03:00',
    endsAt: '2026-06-20T09:45:00-03:00',
    raw: { horario: '09:00' },
  });

  assert.match(db.calls[0].sql, /FROM trinks_slots s/);
  assert.match(db.calls[0].sql, /FROM trinks_service_professionals c/);
  assert.deepEqual(db.calls[0].params, [
    '2026-06-20T00:00:00-03:00',
    '2026-06-21T00:00:00-03:00',
    '10',
    true,
    '20',
  ]);
  assert.match(db.calls[1].sql, /ON CONFLICT \(professional_id, starts_at\)/);
  assert.deepEqual(db.calls[1].params.slice(0, 5), [
    '10',
    '2026-06-20T09:00:00-03:00',
    '2026-06-20T09:45:00-03:00',
    true,
    '{"horario":"09:00"}',
  ]);
});

test('reads clients by id/phone and upserts partial client data', async () => {
  const db = mockDb([
    { rows: [{ trinks_id: '30', phone: '5511999999999' }] },
    { rows: [] },
    { rows: [{ trinks_id: '30' }] },
  ]);
  const store = createTrinksLocalStore(db);

  assert.equal((await store.getClientByTrinksId(30)).trinks_id, '30');
  assert.equal(await store.getClientByPhone('5511888888888'), null);
  await store.upsertClient({
    trinksId: 30,
    phone: '5511999999999',
    name: 'Cliente',
    raw: { id: 30 },
  });

  assert.deepEqual(db.calls[0].params, ['30']);
  assert.match(db.calls[1].sql, /ORDER BY updated_at DESC/);
  assert.deepEqual(db.calls[1].params, ['5511888888888']);
  assert.match(db.calls[2].sql, /INSERT INTO trinks_clients/);
  assert.match(db.calls[2].sql, /phone = COALESCE/);
  assert.deepEqual(db.calls[2].params.slice(0, 7), [
    '30',
    '5511999999999',
    'Cliente',
    null,
    null,
    true,
    '{"id":30}',
  ]);
});

test('reads and upserts appointments using the existing snapshot table', async () => {
  const db = mockDb([
    { rows: [{ trinks_id: '40' }] },
    { rows: [{ trinks_id: '41' }] },
    { rows: [{ trinks_id: '40', status: 'scheduled' }] },
  ]);
  const store = createTrinksLocalStore(db);

  assert.equal((await store.getAppointment(40)).trinks_id, '40');
  const future = await store.listAppointmentsByClient('5511999999999', {
    from: '2026-06-18T00:00:00-03:00',
    to: '2026-07-01T00:00:00-03:00',
  });
  assert.equal(future.length, 1);
  const saved = await store.upsertAppointment({
    trinksId: 40,
    clientTrinksId: 30,
    clientPhone: '5511999999999',
    clientName: 'Cliente',
    professionalId: 10,
    professionalName: 'Ana',
    serviceId: 20,
    serviceName: 'Corte',
    status: 'scheduled',
    scheduledAt: '2026-06-20T09:00:00-03:00',
    durationMin: 45,
    priceCents: 9000,
    raw: { id: 40 },
  });

  assert.equal(saved.status, 'scheduled');
  assert.match(db.calls[0].sql, /FROM trinks_appointments/);
  assert.deepEqual(db.calls[0].params, ['40']);
  assert.match(db.calls[1].sql, /client_phone = \$1/);
  assert.deepEqual(db.calls[1].params, [
    '5511999999999',
    '2026-06-18T00:00:00-03:00',
    '2026-07-01T00:00:00-03:00',
  ]);
  assert.match(db.calls[2].sql, /INSERT INTO trinks_appointments/);
  assert.match(db.calls[2].sql, /ON CONFLICT \(trinks_id\) DO UPDATE/);
  assert.match(db.calls[2].sql, /synced_at = NOW\(\)/);
  assert.equal(db.calls[2].params.length, 18);
  assert.equal(db.calls[2].params[0], '40');
  assert.equal(db.calls[2].params[16], '{"id":40}');
});

test('markSlotWindowAvailable cobre a janela da duração, não só o start', async () => {
  const db = mockDb([{ rows: [{ professional_id: '827204' }] }]);
  const store = createTrinksLocalStore(db);
  await store.markSlotWindowAvailable('827204', '2026-09-05T13:00:00-03:00', 60, false);
  assert.match(db.calls[0].sql, /starts_at >= \$2/);
  assert.match(db.calls[0].sql, /starts_at < \$3/);
  assert.equal(db.calls[0].params[0], '827204');
  assert.equal(db.calls[0].params[3], false);
});

test('listActiveAppointmentWindowsForDate — scheduled/confirmed sem telefone', async () => {
  const db = mockDb([{ rows: [{ professional_id: '826936', scheduled_at: '2026-09-05T12:00:00-03:00', duration_min: 60 }] }]);
  const store = createTrinksLocalStore(db);
  const rows = await store.listActiveAppointmentWindowsForDate('2026-09-05');
  assert.equal(rows.length, 1);
  assert.match(db.calls[0].sql, /FROM trinks_appointments/);
  assert.match(db.calls[0].sql, /scheduled/);
  assert.match(db.calls[0].sql, /confirmed/);
  assert.doesNotMatch(db.calls[0].sql, /client_phone/);
  assert.deepEqual(db.calls[0].params, ['2026-09-05']);
});
