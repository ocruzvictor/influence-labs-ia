#!/usr/bin/env node
/**
 * Replay local intent-null drop — zero DB write.
 *
 * Uso:
 *   node replay_intent_null.js --from 2026-09-01 --to 2026-09-04 --no-dedup
 *   cat corpus.json | node replay_intent_null.js --stdin
 */
const fs = require('fs');
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { dumpFloorCorpus, replayIntentNullDrop } = require('../../../lib/salao-cli-ops');

loadBackendEnv();

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDaysIso(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days, 12));
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function brtDateToUtcTimestamp(isoDate, endOfDay = false) {
  const anchor = endOfDay ? `${addDaysIso(isoDate, 1)}T00:00:00-03:00` : `${isoDate}T00:00:00-03:00`;
  const d = new Date(anchor);
  if (Number.isNaN(d.getTime())) throw new Error(`data BRT inválida: ${isoDate}`);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function resolveWindow(flags) {
  const fromBrt = String(flags.from || '');
  const toBrt = String(flags.to || '');
  if (!ISO_DATE_RE.test(fromBrt) || !ISO_DATE_RE.test(toBrt)) {
    throw new Error('Use --from YYYY-MM-DD --to YYYY-MM-DD (datas BRT, inclusive).');
  }
  if (fromBrt > toBrt) throw new Error('--from não pode ser posterior a --to.');
  return {
    fromBrt,
    toBrt,
    fromIso: brtDateToUtcTimestamp(fromBrt, false),
    toIso: brtDateToUtcTimestamp(toBrt, true),
  };
}

function readStdinJson() {
  const raw = fs.readFileSync(0, 'utf8');
  if (!raw.trim()) throw new Error('stdin vazio');
  return JSON.parse(raw);
}

async function main() {
  const { flags } = parseArgs();
  let rows;

  if (flags.stdin) {
    const payload = readStdinJson();
    rows = payload.utterances || payload.rows || payload;
    if (!Array.isArray(rows)) throw new Error('JSON stdin deve ser array ou { utterances: [] }');
  } else {
    const windowBrt = resolveWindow(flags);
    const dedup = flags['no-dedup'] ? false : true;
    const db = requireDb();
    const corpus = await dumpFloorCorpus(db, {
      fromIso: windowBrt.fromIso,
      toIso: windowBrt.toIso,
      dedup,
    });
    rows = corpus.utterances;
  }

  const report = replayIntentNullDrop(rows);
  printJson({
    ...report,
    grain: 'user_bruto_passive_replay',
    note: 'Zero UPDATE — replay 1º turno sem history',
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
