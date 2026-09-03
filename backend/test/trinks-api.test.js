const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTrinksApi,
  formatPayloadSummary,
  sanitizeAgentMutationMetadata,
} = require('../lib/trinks-api');

function mockDb({ used = 0, provider = null, finalizeFails = false } = {}) {
  return {
    calls: [],
    async query(sql, params) {
      this.calls.push({ sql, params });
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [{ id: 99 }] };
      if (sql.includes('UPDATE trinks_api_requests')) {
        return finalizeFails ? null : { rows: [{ id: params[0] }] };
      }
      if (sql.includes('FROM trinks_api_requests')) {
        return { rows: [{ attempts: used, consumed: used, rejected_429: 0 }] };
      }
      if (sql.includes('FROM trinks_consumption_snapshots')) return { rows: provider ? [provider] : [] };
      return { rows: [] };
    },
  };
}

test('exige estabelecimento configurado', () => {
  assert.throws(
    () => createTrinksApi({ db: mockDb(), apiKey: 'x' }),
    /TRINKS_ESTABELECIMENTO_ID is required/,
  );
});

test('request registra 200 como consumida', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{"ok":true}', { status: 200 }),
  });
  assert.deepEqual(await api.request('/servicos', { origin: 'test' }), { ok: true });
  const update = db.calls.find(c => c.sql.includes('UPDATE trinks_api_requests'));
  assert.equal(update.params[2], true);
});

test('request registra 429 como não consumida e não retenta', async () => {
  const db = mockDb();
  let calls = 0;
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => {
      calls++;
      return new Response('{"message":"Limit Exceeded"}', { status: 429 });
    },
  });
  await assert.rejects(() => api.request('/servicos'), /Trinks 429/);
  assert.equal(calls, 1);
  const update = db.calls.find(c => c.sql.includes('UPDATE trinks_api_requests'));
  assert.equal(update.params[2], false);
});

test('circuit breaker bloqueia no teto operacional', async () => {
  const db = mockDb({ used: 8500 });
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{}'),
  });
  await assert.rejects(
    () => api.request('/agendamentos', { method: 'POST', essential: true }),
    err => err.code === 'TRINKS_BUDGET_BLOCKED',
  );
});

test('snapshot oficial inconsistente não bloqueia operação', async () => {
  const db = mockDb({
    used: 10,
    provider: { quota_total: 10000, total_used: 20018, remaining: 0, consistent: false },
  });
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{}', { status: 200 }),
  });
  await api.request('/agendamentos', { method: 'POST', essential: true });
});

test('Postgres indisponível bloqueia antes da chamada externa', async () => {
  let fetchCalls = 0;
  const api = createTrinksApi({
    db: { query: async () => null },
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => {
      fetchCalls++;
      return new Response('{}');
    },
  });
  await assert.rejects(
    () => api.request('/agendamentos', { method: 'POST', essential: true }),
    err => err.code === 'TRINKS_BUDGET_BLOCKED',
  );
  assert.equal(fetchCalls, 0);
});

test('sucesso externo não vira falha nem repetição quando ledger falha ao finalizar', async () => {
  const db = mockDb({ finalizeFails: true });
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{"id":123}', { status: 201 }),
  });
  assert.deepEqual(
    await api.request('/agendamentos', { method: 'POST', essential: true }),
    { id: 123 },
  );
});

test('snapshot oficial e reserva consideram somente o mês atual', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{}', { status: 200 }),
  });
  await api.request('/consumo', { essential: true });
  const officialRead = db.calls.find(c => c.sql.includes('FROM trinks_consumption_snapshots')
    && !c.sql.includes('pg_advisory_xact_lock'));
  const reservation = db.calls.find(c => c.sql.includes('pg_advisory_xact_lock'));
  assert.match(officialRead.sql, /checked_at >= date_trunc\('month'/);
  assert.match(reservation.sql, /checked_at >= date_trunc\('month'/);
});

test('400 inclui ProblemDetails no err.message', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response(JSON.stringify({
      Message: 'Invalid request.',
      Errors: [{ PropertyName: 'QuemCancelou', ErrorMessage: 'Valor inválido.' }],
    }), { status: 400 }),
  });
  await assert.rejects(
    () => api.request('/agendamentos/1/status/cancelado', { method: 'PATCH', body: {} }),
    (err) => {
      assert.match(err.message, /QuemCancelou: Valor inválido/);
      assert.equal(err.payload.Errors[0].PropertyName, 'QuemCancelou');
      return true;
    },
  );
});

test('formatPayloadSummary trunca detail longo', () => {
  const summary = formatPayloadSummary({ detail: 'x'.repeat(300) });
  assert.equal(summary.length, 200);
});

test('sanitizeAgentMutationMetadata whitelists client_phone and kapso id only (AC6)', () => {
  const meta = sanitizeAgentMutationMetadata('agent_mutation_create', {
    client_phone: '+55 (11) 99999-0517',
    kapso_conversation_id: 'conv-123',
    client_name: 'Maria',
    body: { foo: 'bar' },
    telefone_formatado: '+55 11 99999-0517',
  });
  assert.deepEqual(meta, {
    client_phone: '5511999990517',
    kapso_conversation_id: 'conv-123',
  });
  assert.ok(!JSON.stringify(meta).includes('Maria'));
});

test('agent_mutation request persists whitelisted metadata in ledger (AC6)', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{"id":1}', { status: 201 }),
  });
  await api.request('/agendamentos', {
    method: 'POST',
    origin: 'agent_mutation_create',
    essential: true,
    metadata: {
      client_phone: '5511999990517',
      kapso_conversation_id: 'kapso-1',
      nome: 'Cliente',
    },
  });
  const reserve = db.calls.find(c => c.sql.includes('INSERT INTO trinks_api_requests'));
  const saved = JSON.parse(reserve.params[3]);
  assert.deepEqual(saved, {
    client_phone: '5511999990517',
    kapso_conversation_id: 'kapso-1',
  });
});

test('non agent_mutation preserves page metadata behavior', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => new Response('{"ok":true}', { status: 200 }),
  });
  await api.request('/servicos?page=2', { origin: 'snapshot_sync' });
  const reserve = db.calls.find(c => c.sql.includes('INSERT INTO trinks_api_requests'));
  const saved = JSON.parse(reserve.params[3]);
  assert.equal(saved.page, 2);
  assert.equal(saved.client_phone, undefined);
});

test('agent_mutation transport error persists whitelisted metadata only', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => {
      throw new Error('Cliente Maria falhou telefone +55 11 99999-0517');
    },
  });
  await assert.rejects(
    () => api.request('/agendamentos', {
      method: 'POST',
      origin: 'agent_mutation_create',
      essential: true,
      metadata: {
        client_phone: '+55 (11) 99999-0517',
        kapso_conversation_id: 'kapso-1',
        nome: 'Maria',
        body: { foo: 'bar' },
      },
    }),
  );
  const finalize = db.calls.find(c => c.sql.includes('UPDATE trinks_api_requests'));
  const saved = JSON.parse(finalize.params[4]);
  assert.deepEqual(saved, {
    client_phone: '5511999990517',
    kapso_conversation_id: 'kapso-1',
  });
  assert.equal(saved.error, undefined);
  assert.ok(!JSON.stringify(saved).includes('Maria'));
});

test('non agent_mutation transport error keeps page and error metadata', async () => {
  const db = mockDb();
  const api = createTrinksApi({
    db,
    baseUrl: 'https://example.test',
    apiKey: 'x',
    establishmentId: '1',
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  await assert.rejects(
    () => api.request('/servicos?page=3', { origin: 'snapshot_sync' }),
    /network down/,
  );
  const finalize = db.calls.find(c => c.sql.includes('UPDATE trinks_api_requests'));
  const saved = JSON.parse(finalize.params[4]);
  assert.equal(saved.page, 3);
  assert.equal(saved.error, 'network down');
});
