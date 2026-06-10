/**
 * Monitor de cota da API Trinks (story salon-whatsapp-trinks-quota-monitor).
 *
 * A Trinks limita por mês (5.000 base + adicionais R$60/+5.000, NÃO cumulativos).
 * DOIS processos consomem a mesma chave (backend bot + worker sync) → contador ÚNICO
 * no Postgres (tabela trinks_api_usage), ambos incrementam, /health lê.
 *
 * Granularidade DIÁRIA (chave = dia no fuso do salão): pega runaway no mesmo dia,
 * permite extrato dia-a-dia pra cruzar com a fatura Trinks (fim do ponto cego).
 * O total mensal é a soma dos dias do mês corrente.
 *
 * `db` é injetado (mesmo ./db dos 2 processos). nowFn injetável p/ testes.
 * recordTrinksCall é fire-and-forget (nunca quebra o hot-path nem o worker).
 */

function _parts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = f.formatToParts(date);
  const pick = t => p.find(x => x.type === t)?.value;
  return { y: pick('year'), m: pick('month'), d: pick('day') };
}

// 'YYYY-MM-DD' no fuso do salão (chave do contador diário).
function salonDayKey(date = new Date(), tz = 'America/Sao_Paulo') {
  const { y, m, d } = _parts(date, tz);
  return `${y}-${m}-${d}`;
}

// 'YYYY-MM' no fuso do salão (cota reseta por mês).
function salonMonthKey(date = new Date(), tz = 'America/Sao_Paulo') {
  const { y, m } = _parts(date, tz);
  return `${y}-${m}`;
}

// Incrementa o contador do DIA corrente (+1 por chamada Trinks). Fire-and-forget.
function recordTrinksCall(db, nowFn = () => new Date()) {
  if (!db || typeof db.query !== 'function') return Promise.resolve();
  const day = salonDayKey(nowFn());
  return db.query(
    `INSERT INTO trinks_api_usage (day, used) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET used = trinks_api_usage.used + 1, updated_at = NOW()`,
    [day],
  ).catch((err) => { try { console.error('[trinks-usage] record falhou:', err.message); } catch (_) {} });
}

// Snapshot da cota do mês corrente (soma dos dias) + consumo de hoje. budget = limite contratado.
async function getTrinksUsage(db, budget, nowFn = () => new Date()) {
  const month = salonMonthKey(nowFn());
  const today = salonDayKey(nowFn());
  let used = 0, usedToday = 0;
  try {
    const r = await db.query(
      `SELECT COALESCE(SUM(used), 0) AS used,
              COALESCE(SUM(used) FILTER (WHERE day = $2), 0) AS today
         FROM trinks_api_usage
        WHERE to_char(day, 'YYYY-MM') = $1`,
      [month, today],
    );
    used = Number(r?.rows?.[0]?.used ?? 0);
    usedToday = Number(r?.rows?.[0]?.today ?? 0);
  } catch (err) {
    try { console.error('[trinks-usage] read falhou:', err.message); } catch (_) {}
  }
  const remaining = Math.max(0, budget - used);
  const pct = budget > 0 ? Math.round((used / budget) * 1000) / 1000 : 0;
  return { month, today, used, used_today: usedToday, budget, remaining, pct };
}

// Quais thresholds (ex: [0.8,0.9,1.0]) foram cruzados e ainda não alertados neste mês.
function newlyCrossed(pct, thresholds, alreadyAlerted) {
  const done = alreadyAlerted instanceof Set ? alreadyAlerted : new Set(alreadyAlerted || []);
  return thresholds.filter(t => pct >= t && !done.has(t));
}

module.exports = { salonDayKey, salonMonthKey, recordTrinksCall, getTrinksUsage, newlyCrossed };
