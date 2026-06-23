const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createTrinksWebhookProcessor,
  unwrapMessage,
  mapClient,
  mapProfessional,
} = require('../lib/trinks-webhook-processor');

test('unwrapMessage aceita shape EventId/Action/Data', () => {
  const out = unwrapMessage({
    Message: JSON.stringify({ EventId: 11, Action: 1, Data: { id: 99 } }),
  });
  assert.equal(out.eventId, 11);
  assert.equal(out.actionId, 1);
  assert.equal(out.payload.id, 99);
});

test('mapeia cliente e profissional de webhook', () => {
  assert.equal(mapClient({ id: 1, telefone: '11999999999' }).phone, '5511999999999');
  assert.equal(mapProfessional({ id: 2, nome: 'Ana', apelido: 'Aninha' }).nickname, 'Aninha');
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
