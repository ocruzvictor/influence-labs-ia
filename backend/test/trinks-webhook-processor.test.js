const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTrinksWebhookProcessor,
  unwrapMessage,
  mapClient,
  mapProfessional,
} = require('../lib/trinks-webhook-processor');

const PT_APPOINTMENT_MESSAGE = {
  Action: 1,
  TipoDeEvento: 11,
  IdDoAgendamento: 520997912,
  IdDoCliente: 1498,
  IdDoClienteNoEstabelecimento: 313603,
  IdDoProfissional: 8398,
  IdDoProfissionalNoEstabelecimento: 14342,
  IdDoServico: 208,
  IdDoServicoNoEstabelecimento: 5233,
  NomeDoServicoNoEstabelecimento: 'Corte',
  NomeDoCliente: 'Maria Silva',
  DataHoraInicioDoAgendamento: '2026-08-15 14:30:00',
  DuracaoDoAgendamento: 40,
  PrecoDoServicoNoAgendamento: '10,00',
  Status: 'Confirmado',
  TelefoneDoCliente: [{ DDD: '11', Numero: '937750330', TelefoneCompleto: '(11) 93775-0330' }],
};

test('unwrapMessage aceita shape EventId/Action/Data', () => {
  const out = unwrapMessage({
    Message: JSON.stringify({ EventId: 11, Action: 1, Data: { id: 99 } }),
  });
  assert.equal(out.eventId, 11);
  assert.equal(out.actionId, 1);
  assert.equal(out.payload.id, 99);
});

test('unwrapMessage aceita TipoDeEvento no envelope SNS PT', () => {
  const out = unwrapMessage({
    Message: JSON.stringify(PT_APPOINTMENT_MESSAGE),
  });
  assert.equal(out.eventId, 11);
  assert.equal(out.actionId, 1);
  assert.equal(out.payload.IdDoAgendamento, 520997912);
});

test('mapeia cliente e profissional de webhook', () => {
  assert.equal(mapClient({ id: 1, telefone: '11999999999' }).phone, '5511999999999');
  assert.equal(mapProfessional({ id: 2, nome: 'Ana', apelido: 'Aninha' }).nickname, 'Aninha');
  assert.equal(
    mapClient({
      IdDoClienteNoEstabelecimento: 10,
      NomeDoCliente: 'João',
      TelefoneDoCliente: [{ DDD: '11', Numero: '988887777' }],
    }).phone,
    '5511988887777',
  );
});

test('retorna o TopicArn da ultima assinatura confirmada', async () => {
  const processor = createTrinksWebhookProcessor({
    db: {
      async query(sql) {
        assert.match(sql, /SubscriptionConfirmation/);
        return { rows: [{ topic_arn: 'arn:aws:sns:us-east-1:123456789012:trinks' }] };
      },
    },
    store: {},
  });
  assert.equal(
    await processor.getConfirmedTopicArn(),
    'arn:aws:sns:us-east-1:123456789012:trinks',
  );
});

test('persistência é idempotente e evento de cliente é processado', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO trinks_webhook_events')) return { rows: [{ message_id: params[0] }] };
      return { rows: [] };
    },
  };
  const saved = [];
  const processor = createTrinksWebhookProcessor({
    db,
    store: {
      upsertClient: async value => saved.push(value),
      upsertProfessional: async () => {},
      getClientByTrinksId: async () => null,
      upsertAppointment: async () => {},
    },
  });
  const envelope = {
    MessageId: 'm1',
    TopicArn: 'arn:test',
    Type: 'Notification',
    Message: JSON.stringify({ EventId: 3, Action: 1, Data: { id: 10, telefone: '11999999999' } }),
  };
  assert.deepEqual(await processor.persistEnvelope(envelope), { duplicate: false });
  await processor.processNotification(envelope);
  assert.equal(saved[0].trinksId, 10);
  assert.match(calls.at(-1).sql, /UPDATE trinks_webhook_events/);
});

test('processNotification com envelope SNS PT upsert agendamento', async () => {
  const updates = [];
  const saved = [];
  const processor = createTrinksWebhookProcessor({
    db: {
      async query(sql, params) {
        if (sql.includes('UPDATE trinks_webhook_events')) updates.push(params);
        return { rows: [] };
      },
    },
    store: {
      upsertClient: async () => {},
      upsertProfessional: async () => {},
      getClientByTrinksId: async () => null,
      upsertAppointment: async value => saved.push(value),
    },
  });
  const envelope = {
    MessageId: 'pt-11',
    TopicArn: 'arn:test',
    Type: 'Notification',
    Message: JSON.stringify(PT_APPOINTMENT_MESSAGE),
  };
  const result = await processor.processNotification(envelope);
  assert.equal(result.eventId, 11);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].trinksId, '520997912');
  assert.equal(saved[0].clientPhone, '5511937750330');
  assert.equal(saved[0].status, 'confirmed');
  assert.equal(saved[0].priceCents, 1000);
  assert.equal(saved[0].durationMin, 40);
  assert.equal(saved[0].scheduledAt, '2026-08-15T14:30:00-03:00');
  assert.equal(updates.at(-1)[2], 'processed');
});

test('evento fechamento de conta (1) marca processed sem throw', async () => {
  const updates = [];
  const processor = createTrinksWebhookProcessor({
    db: {
      async query(sql, params) {
        if (sql.includes('UPDATE trinks_webhook_events')) updates.push(params);
        return { rows: [] };
      },
    },
    store: {
      upsertClient: async () => { throw new Error('should not upsert'); },
      upsertProfessional: async () => { throw new Error('should not upsert'); },
      getClientByTrinksId: async () => null,
      upsertAppointment: async () => { throw new Error('should not upsert'); },
    },
  });
  const envelope = {
    MessageId: 'fechamento-1',
    TopicArn: 'arn:test',
    Type: 'Notification',
    Message: JSON.stringify({ Action: 1, TipoDeEvento: 1, IdDoEstabelecimento: 1253 }),
  };
  const result = await processor.processNotification(envelope);
  assert.equal(result.ignored, true);
  assert.equal(result.eventId, 1);
  assert.equal(updates.at(-1)[2], 'processed');
});

test('evento falho pode ser reprocessado e evento desconhecido fica failed', async () => {
  let insertCount = 0;
  let insertSql = '';
  const updates = [];
  const db = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO trinks_webhook_events')) {
        insertCount++;
        insertSql = sql;
        return { rows: [{ message_id: params[0] }] };
      }
      if (sql.includes('UPDATE trinks_webhook_events')) {
        updates.push(params);
        return { rows: [{ message_id: params[0] }] };
      }
      return { rows: [] };
    },
  };
  const processor = createTrinksWebhookProcessor({
    db,
    store: {
      upsertClient: async () => {},
      upsertProfessional: async () => {},
      getClientByTrinksId: async () => null,
      upsertAppointment: async () => {},
    },
  });
  const envelope = {
    MessageId: 'retry-1',
    TopicArn: 'arn:test',
    Type: 'Notification',
    Message: JSON.stringify({ EventId: 999, Action: 1, Data: { id: 10 } }),
  };
  await processor.persistEnvelope(envelope);
  assert.match(insertSql, /INTERVAL '5 minutes'/);
  await assert.rejects(() => processor.processNotification(envelope), /Unsupported/);
  assert.equal(updates.at(-1)[2], 'failed');
  assert.deepEqual(await processor.persistEnvelope(envelope), { duplicate: false });
  assert.equal(insertCount, 2);
});
