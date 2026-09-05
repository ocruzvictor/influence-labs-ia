/**
 * Story 6 AC3 — p95 de duration_ms por context_profile em tess.turn.
 * SOT: docs/analysis/2026-09-04-dara-chao-5-credito-schema.md · tetos: aria-chao-6-timeout-tetos.md
 */

const { salonDayKey } = require('./trinks-usage');
const { DEFAULT_ABORT_MS, TESS_ABORT_HARD_CEILING_MS } = require('./tess-timeout-budget');

const HEAVY_PROFILES = new Set(['BOOKING', 'FULL']);
const LEAN_PROFILES = new Set(['MIN', 'FAQ', 'PRICE', 'CANCEL']);

/**
 * @param {import('pg').Pool|{ query: Function }} db
 * @param {{ salonDay?: string, minSamples?: number }} [opts]
 */
async function queryP95ByProfile(db, { salonDay, minSamples = 5 } = {}) {
  const day = salonDay || salonDayKey();
  const { rows } = await db.query(
    `SELECT
       payload->>'context_profile' AS profile,
       COUNT(*)::int AS n,
       ROUND(percentile_cont(0.95) WITHIN GROUP (
         ORDER BY (payload->>'duration_ms')::numeric
       ))::int AS p95_ms,
       ROUND(AVG((payload->>'duration_ms')::numeric))::int AS avg_ms,
       MAX((payload->>'duration_ms')::numeric)::int AS max_ms,
       (COUNT(*) FILTER (WHERE COALESCE((payload->>'timed_out')::boolean, false)))::int AS timed_out
     FROM bot_operational_events
     WHERE event = 'tess.turn'
       AND payload->>'salon_day' = $1
       AND COALESCE((payload->>'skipped_tess')::boolean, false) = false
       AND (payload->>'duration_ms') IS NOT NULL
       AND (payload->>'duration_ms')::numeric > 0
     GROUP BY 1
     ORDER BY 1`,
    [day],
  );
  return { salon_day: day, profiles: rows, min_samples: minSamples };
}

/**
 * @param {{ salon_day: string, profiles: Array<{ profile: string, n: number, p95_ms: number|null, avg_ms: number|null, max_ms: number|null, timed_out: number }>, min_samples?: number }} report
 */
function interpretStory6Ac3(report) {
  const minSamples = report.min_samples ?? 5;
  const caps = { ...DEFAULT_ABORT_MS };
  const verdicts = [];
  let ac3Pass = true;
  let ac3Actionable = false;

  for (const row of report.profiles) {
    const profile = row.profile || 'UNKNOWN';
    const cap = caps[profile] ?? caps.FULL;
    const sampleOk = row.n >= minSamples;
    const entry = {
      profile,
      n: row.n,
      p95_ms: row.p95_ms,
      avg_ms: row.avg_ms,
      max_ms: row.max_ms,
      timed_out: row.timed_out,
      abort_cap_ms: cap,
      sample_ok: sampleOk,
      ac3: null,
      note: null,
    };

    if (!sampleOk) {
      entry.ac3 = 'INSUFFICIENT_DATA';
      entry.note = `Precisa ≥${minSamples} turnos com duration_ms neste perfil.`;
    } else if (HEAVY_PROFILES.has(profile)) {
      ac3Actionable = true;
      if (row.p95_ms <= cap) {
        entry.ac3 = 'PASS';
        entry.note = `p95 ${row.p95_ms}ms ≤ teto ${cap}ms.`;
      } else if (row.p95_ms <= TESS_ABORT_HARD_CEILING_MS) {
        entry.ac3 = 'ADJUST_CAP';
        ac3Pass = false;
        entry.note = `p95 ${row.p95_ms}ms > teto ${cap}ms e ≤ ${TESS_ABORT_HARD_CEILING_MS}ms — subir TESS_ABORT_MS_${profile} (não apertar abaixo do p95).`;
      } else {
        entry.ac3 = 'FAIL';
        ac3Pass = false;
        entry.note = `p95 ${row.p95_ms}ms > parede ${TESS_ABORT_HARD_CEILING_MS}ms — investigar degradação (sem subir Nginx).`;
      }
    } else if (LEAN_PROFILES.has(profile)) {
      entry.ac3 = 'INFO';
      entry.note = `Perfil lean — referência; teto atual ${cap}ms.`;
    } else {
      entry.ac3 = 'INFO';
      entry.note = 'Perfil fora da tabela lean/heavy.';
    }
    verdicts.push(entry);
  }

  const heavyWithData = verdicts.filter((v) => HEAVY_PROFILES.has(v.profile) && v.sample_ok);
  if (!heavyWithData.length) {
    ac3Pass = false;
    ac3Actionable = false;
  }

  return {
    salon_day: report.salon_day,
    min_samples: minSamples,
    ac3_overall: ac3Actionable ? (ac3Pass ? 'PASS' : 'ACTION_NEEDED') : 'WAIT_TRAFFIC',
    heavy_profiles: [...HEAVY_PROFILES],
    lean_profiles: [...LEAN_PROFILES],
    default_caps_ms: caps,
    profiles: verdicts,
    hint: ac3Actionable
      ? null
      : 'Rode amanhã com tráfego info-open/0007. Só turnos pagos com duration_ms contam.',
  };
}

/**
 * @param {import('pg').Pool|{ query: Function }} db
 * @param {{ salonDay?: string, minSamples?: number }} [opts]
 */
async function medirP95TessTurn(db, opts = {}) {
  const raw = await queryP95ByProfile(db, opts);
  return {
    ...interpretStory6Ac3({ ...raw, min_samples: opts.minSamples }),
    raw_counts: raw.profiles,
  };
}

module.exports = {
  queryP95ByProfile,
  interpretStory6Ac3,
  medirP95TessTurn,
  HEAVY_PROFILES,
  LEAN_PROFILES,
};
