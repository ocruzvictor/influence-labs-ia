#!/usr/bin/env node
/**
 * Dump empírico conversation_history — last4 only, zero E.164.
 *
 * Uso: node dump_corpus_semana.js --from 2026-09-01 --to 2026-09-04
 *      node dump_corpus_semana.js --from 2026-09-01 --to 2026-09-04 --md docs/analysis/floor-corpus-20260904.md
 */
const fs = require('fs');
const path = require('path');
const { loadBackendEnv, parseArgs, printJson, requireDb } = require('../_lib/cli');
const { dumpFloorCorpus } = require('../../../lib/salao-cli-ops');

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

function formatMarkdown(corpus, windowBrt) {
  const lines = [];
  lines.push('# Floor corpus — extract-week-corpus');
  lines.push('');
  lines.push(`Janela BRT: **${windowBrt.fromBrt}** → **${windowBrt.toBrt}** (inclusive)`);
  lines.push(`Bounds UTC (stored): \`${corpus.window.from}\` ≤ created_at < \`${corpus.window.to}\``);
  lines.push(`Dedup: ${corpus.dedup ? 'sim (last4 + texto normalizado)' : 'não'}`);
  lines.push('');
  lines.push('| last4 | role | agent | intent | created_at | text |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of corpus.utterances) {
    const text = String(row.text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${row.last4 || '—'} | ${row.role || ''} | ${row.agent || ''} | ${row.intent ?? ''} | ${row.created_at || ''} | ${text} |`);
  }
  lines.push('');
  lines.push('## Stats');
  lines.push('');
  lines.push(`- threads_last4: ${corpus.stats.threads_last4}`);
  lines.push(`- unique_utterances: ${corpus.stats.unique_utterances}`);
  lines.push(`- tess_replied: ${corpus.stats.tess_replied}`);
  lines.push(`- inbound_only: ${corpus.stats.inbound_only}`);
  lines.push(`- intent_null_count: ${corpus.stats.intent_null_count}`);
  lines.push(`- staff_outbound_in_window: ${corpus.stats.staff_outbound_in_window}`);
  lines.push('');
  lines.push('_Artefato sem E.164 — apenas last4._');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const { flags } = parseArgs();
  const windowBrt = resolveWindow(flags);
  const dedup = flags['no-dedup'] ? false : true;
  const db = requireDb();
  const corpus = await dumpFloorCorpus(db, {
    fromIso: windowBrt.fromIso,
    toIso: windowBrt.toIso,
    dedup,
  });
  const payload = {
    ...corpus,
    window_brt: { from: windowBrt.fromBrt, to: windowBrt.toBrt },
  };

  if (flags.md && flags.md !== true) {
    const outPath = path.resolve(process.cwd(), flags.md);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, formatMarkdown(corpus, windowBrt), 'utf8');
    payload.markdown_path = outPath;
  }

  printJson(payload);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
