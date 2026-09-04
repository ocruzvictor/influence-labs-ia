const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  listStuckThreadsFiltered,
  listAckWithoutOutbound,
  checarFrescuraSnapshot,
  relatarSloEventos,
  listarFilaAtendimento,
  correlacionarLast4,
  dumpFloorCorpus,
} = require('../lib/salao-cli-ops');

test('listStuckThreadsFiltered hides silenced and human_only', async () => {
  const now = new Date();
  const db = {
    query: async () => ({
      rows: [
        {
          client_phone: '5511964540007',
          role: 'user',
          content: 'oi',
          created_at: new Date(now.getTime() - 10 * 60000),
          whitelist_mode: 'allow',
          silenced_until: null,
        },
        {
          client_phone: '5511999991111',
          role: 'user',
          content: 'quero humano',
          created_at: new Date(now.getTime() - 20 * 60000),
          whitelist_mode: 'human_only',
          silenced_until: null,
        },
        {
          client_phone: '5511999992222',
          role: 'user',
          content: 'handoff',
          created_at: new Date(now.getTime() - 15 * 60000),
          whitelist_mode: null,
          silenced_until: new Date(now.getTime() + 3600000),
        },
      ],
    }),
  };
  const result = await listStuckThreadsFiltered(db, { filtrarSilence: true });
  assert.equal(result.total_raw, 3);
  assert.equal(result.total_visible, 1);
  assert.equal(result.threads[0].last4, '0007');
});

test('listAckWithoutOutbound redacts to last4', async () => {
  const db = {
    query: async () => ({
      rows: [{
        client_phone: '5511964540007',
        role: 'user',
        content: 'alô',
        created_at: new Date(Date.now() - 120000),
        agent: 'passive',
      }],
    }),
  };
  const result = await listAckWithoutOutbound(db, { minutos: 60, segundos: 45 });
  assert.equal(result.silences[0].last4, '0007');
  assert.ok(!JSON.stringify(result).includes('5511964540007'));
});

test('checarFrescuraSnapshot marks stale parts', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('UNION ALL')) {
        return {
          rows: [
            { kind: 'professionals', synced_at: new Date(Date.now() - 2 * 3600000), n: 12 },
            { kind: 'slots', synced_at: new Date(Date.now() - 48 * 3600000), n: 10 },
          ],
        };
      }
      return { rows: [{ covered: true }] };
    },
  };
  const result = await checarFrescuraSnapshot(db, { maxIdadeHoras: 24 });
  assert.equal(result.stale, true);
  assert.equal(result.parts.find((p) => p.kind === 'slots').stale, true);
  assert.equal(result.parts.find((p) => p.kind === 'professionals').stale, false);
});

test('relatarSloEventos exposes per_hour burn-rate', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('GROUP BY')) {
        return { rows: [{ event: 'tess.timeout', n: 2 }, { event: 'handoff.human', n: 1 }] };
      }
      return { rows: [] };
    },
  };
  const report = await relatarSloEventos(db, { minutos: 60 });
  assert.equal(report.per_hour['tess.timeout'], 2);
  assert.equal(report.per_hour['booking.failed'], 0);
});

test('listarFilaAtendimento redacts to last4 and keeps trace_id', async () => {
  const db = {
    query: async () => ({
      rows: [{
        client_phone: '5511964540007',
        role: 'user',
        content: 'quero cortar',
        intent: 'SCHEDULING',
        trace_id: 'trace-fila',
        created_at: new Date(),
        agent: null,
        last_user_content: 'quero cortar',
        last_user_intent: 'SCHEDULING',
        last_user_at: new Date(),
        whitelist_mode: 'allow',
        silenced_until: null,
        silence_reason: null,
        last_handoff_at: null,
        last_handoff_motivo: null,
        last_event: 'tess.turn',
        last_event_motivo: 'SCHEDULING:BOOKING',
        last_event_payload: { context_profile: 'BOOKING', tess_credits: 12, trace_id: 'trace-fila' },
      }],
    }),
  };
  const result = await listarFilaAtendimento(db, { horas: 12 });
  assert.equal(result.threads[0].last4, '0007');
  assert.equal(result.threads[0].trace_id, 'trace-fila');
  assert.equal(result.threads[0].context_profile, 'BOOKING');
  assert.ok(!JSON.stringify(result).includes('5511964540007'));
});

test('dumpFloorCorpus returns last4 only and redacts E.164 in text', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('bot_thread_state')) return { rows: [{ n: 2 }] };
      return {
        rows: [
          {
            last4: '0007',
            role: 'user',
            agent: null,
            intent: 'SCHEDULING',
            text: 'meu zap 5511964540007',
            created_at: '2026-09-02 14:00:00',
          },
          {
            last4: '1111',
            role: 'assistant',
            agent: 'tess',
            intent: null,
            text: 'confirmado',
            created_at: '2026-09-02 14:01:00',
          },
        ],
      };
    },
  };
  const result = await dumpFloorCorpus(db, {
    fromIso: '2026-09-01 03:00:00',
    toIso: '2026-09-05 03:00:00',
    dedup: false,
  });
  assert.equal(result.utterances[0].last4, '0007');
  assert.equal(result.utterances[1].last4, '1111');
  assert.ok(!JSON.stringify(result).includes('5511964540007'));
  assert.match(result.utterances[0].text, /\[phone\]/);
  assert.equal(result.stats.staff_outbound_in_window, 2);
});

test('dumpFloorCorpus dedup collapses duplicate last4+same text', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('bot_thread_state')) return { rows: [{ n: 0 }] };
      return {
        rows: [
          {
            last4: '0007',
            role: 'user',
            agent: null,
            intent: null,
            text: 'Oi',
            created_at: '2026-09-02 10:00:00',
          },
          {
            last4: '0007',
            role: 'user',
            agent: null,
            intent: null,
            text: 'oi',
            created_at: '2026-09-02 11:00:00',
          },
        ],
      };
    },
  };
  const result = await dumpFloorCorpus(db, {
    fromIso: '2026-09-01 03:00:00',
    toIso: '2026-09-05 03:00:00',
    dedup: true,
  });
  assert.equal(result.utterances.length, 1);
  assert.equal(result.stats.unique_utterances, 1);
  assert.equal(result.stats.threads_last4, 1);
});

test('dumpFloorCorpus stats tess_replied and inbound_only', async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes('bot_thread_state')) return { rows: [{ n: 0 }] };
      return {
        rows: [
          {
            last4: '0007',
            role: 'user',
            agent: null,
            intent: 'FAQ',
            text: 'horário?',
            created_at: '2026-09-02 10:00:00',
          },
          {
            last4: '0007',
            role: 'assistant',
            agent: 'tess',
            intent: 'FAQ',
            text: 'abrimos 9h',
            created_at: '2026-09-02 10:01:00',
          },
          {
            last4: '2222',
            role: 'user',
            agent: 'passive',
            intent: null,
            text: 'só olhando',
            created_at: '2026-09-02 12:00:00',
          },
          {
            last4: '3333',
            role: 'user',
            agent: null,
            intent: null,
            text: 'tem vaga?',
            created_at: '2026-09-02 13:00:00',
          },
          {
            last4: '3333',
            role: 'assistant',
            agent: 'passive',
            intent: null,
            text: 'eco',
            created_at: '2026-09-02 13:01:00',
          },
        ],
      };
    },
  };
  const result = await dumpFloorCorpus(db, {
    fromIso: '2026-09-01 03:00:00',
    toIso: '2026-09-05 03:00:00',
    dedup: false,
  });
  assert.equal(result.stats.tess_replied, 1);
  assert.equal(result.stats.inbound_only, 2);
  assert.equal(result.stats.intent_null_count, 3);
  assert.equal(result.stats.threads_last4, 3);
});

test('correlacionarLast4 by trace_id skips the 30min last4 window', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('trace_id = $1')) {
        return { rows: [{ phone: '5511964540007' }] };
      }
      return { rows: [] };
    },
  };
  const result = await correlacionarLast4(db, { traceId: 'trace-xyz' });
  assert.equal(result.trace_id, 'trace-xyz');
  assert.equal(result.last4, '0007');
  assert.equal(result.window_min, 180);
  assert.ok(calls[0].params[0] === 'trace-xyz');
});

test('replayIntentNullDrop — miniatura 383-shape', () => {
  const { replayIntentNullDrop } = require('../lib/salao-cli-ops');
  const rows = [
    { last4: '0007', role: 'user', intent: null, text: 'Oi, vim pelo Studio Tirra. Quero agendar' },
    { last4: '4749', role: 'user', intent: null, text: 'horário na sexta final do dia' },
    { last4: '0285', role: 'user', intent: null, text: 'com o André' },
    { last4: '0330', role: 'user', intent: null, text: '[CLIENTE ENVIOU IMAGEM]' },
    { last4: '3653', role: 'user', intent: 'SCHEDULING', text: 'quero cortar' },
  ];
  const report = replayIntentNullDrop(rows, { baselineNull: 383 });
  assert.equal(report.would_fill, 3);
  assert.ok(report.drop >= 1);
  assert.equal(report.replay_null, 380);
  assert.equal(report.filled_sample.length, 3);
  assert.ok(report.filled_sample.every((s) => s.would_intent === 'SCHEDULING'));
});
