/**
 * Regression test — CANCEL high must stay slim in effective FULL mode.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assembleTessContext } = require('../lib/tess-context-assembler');
const { INTENTS } = require('../lib/tess-context-intent');
const { parseTessContextConfig } = require('../lib/tess-context-config');

test('CANCEL high + full → only future bookings, no schedule/catalog/professionals', async () => {
  const calls = {
    slots: 0,
    groupedSlots: 0,
    catalog: 0,
    professionals: 0,
    future: 0,
  };
  const futureBookings = [{ trinks_id: '526180491', service_id: 1 }];

  const result = await assembleTessContext({
    sessionId: 'story-12-cancel-full',
    messageText: 'pode cancelar esse também',
    phone: '0007',
    intentResult: { intent: INTENTS.CANCEL, confidence: 'high', signals: ['cancel'] },
    config: parseTessContextConfig({ TESS_CONTEXT_MODE: 'full' }),
    slotContextDays: 10,
    requestedDate: null,
    historyForModel: [],
    persistedForModel: null,
    trinksCanonicalName: null,
    operatorResumeNote: null,
    operatorResumeTrigger: null,
    buildDynamicContext: (slotDates, slots, profs, history, services, persisted, bookings) => {
      assert.deepEqual(slotDates, []);
      assert.equal(slots, '');
      assert.equal(profs, '');
      assert.equal(services, '');
      assert.deepEqual(bookings, futureBookings);
      return 'CONTEXTO CANCEL ENXUTO';
    },
    getSlots: async () => {
      calls.slots++;
      throw new Error('getSlots não deveria ser chamado');
    },
    getSlotsGrouped: async () => {
      calls.groupedSlots++;
      throw new Error('getSlotsGrouped não deveria ser chamado');
    },
    getProfessionals: async () => {
      calls.professionals++;
      throw new Error('getProfessionals não deveria ser chamado');
    },
    getServicesText: async () => {
      calls.catalog++;
      throw new Error('getServicesText não deveria ser chamado');
    },
    loadClientFutureBookings: async () => {
      calls.future++;
      return futureBookings;
    },
    ensureSlotSnapshot: async () => {
      throw new Error('ensureSlotSnapshot não deveria ser chamado');
    },
    getNextBusinessDays: () => {
      throw new Error('getNextBusinessDays não deveria ser chamado');
    },
    mergeSlotContextDates: () => {
      throw new Error('mergeSlotContextDates não deveria ser chamado');
    },
    nextSaturdayDates: () => {
      throw new Error('nextSaturdayDates não deveria ser chamado');
    },
  });

  assert.equal(result.contextProfile, 'CANCEL');
  assert.deepEqual(result.slotDates, []);
  assert.deepEqual(result.futureBookings, futureBookings);
  assert.equal(result.fetchMeta.futureBookingsRequested, true);
  assert.deepEqual(calls, {
    slots: 0,
    groupedSlots: 0,
    catalog: 0,
    professionals: 0,
    future: 1,
  });
  assert.equal(result.blocks.horarios, '');
  assert.equal(result.blocks.servicos, '');
  assert.equal(result.blocks.profissionais, '');
});
