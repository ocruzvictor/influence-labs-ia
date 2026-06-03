/**
 * Monitor de cota da API Trinks (story salon-whatsapp-trinks-quota-monitor).
 *
 * A Trinks limita 5.000 req/mês (base) + adicionais R$60/+5.000 NÃO cumulativos.
 * DOIS processos consomem a mesma chave (backend bot + worker sync) → contador ÚNICO
 * no Postgres (tabela trinks_api_usage), ambos incrementam, /health lê.
 *
 * `db` é injetado (mesmo módulo ./db dos 2 processos). nowFn injetável p/ testes.
 * recordTrinksCall é fire-and-forget (nunca quebra o hot-path nem o worker).
 */

// 'YYYY-MM' no fuso do salão (cota reseta por mês-calendário).
function salonMonthKey(date = new Date(), tz = 'America/Sao_Paulo') {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' });
  const parts = f.formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  return `${y}-${m}`;
}

// Incrementa o contador do mês corrente (+1 por chamada Trinks). Fire-and-forget.
function recordTrinksCall(db, nowFn = () => new Date()) {
  if (!db || typeof db.query !== 'function') return Promise.resolve();
  const key = salonMonthKey(nowFn());
  return db.query(
    `INSERT INTO trinks_api_usage (yyyymm, used) VALUES ($1, 1)
     ON CONFLICT (yyyymm) DO UPDATE SET used = trinks_api_usage.used + 1, updated_at = NOW()`,
    [key],
  ).catch((err) => { try { console.error('[trinks-usage] record falhou:', err.message); } catch (_) {} });
}

// Snapshot da cota do mês corrente. budget = limite contratado (base + adicionais).
async function getTrinksUsage(db, budget, nowFn = () => new Date()) {
  const month = salonMonthKey(nowFn());
  let used = 0;
  try {
    const r = await db.query('SELECT used FROM trinks_api_usage WHERE yyyymm = $1', [month]);
    used = r?.rows?.[0]?.used ?? 0;
  } catch (err) {
    try { console.error('[trinks-usage] read falhou:', err.message); } catch (_) {}
  }
  const remaining = Math.max(0, budget - used);
  const pct = budget > 0 ? Math.round((used / budget) * 1000) / 1000 : 0;
  return { month, used, budget, remaining, pct };
}

// Quais thresholds (ex: [0.8,0.9,1.0]) foram cruzados e ainda não alertados neste mês.
// Pura — facilita o teste do gatilho de alerta.
function newlyCrossed(pct, thresholds, alreadyAlerted) {
  const done = alreadyAlerted instanceof Set ? alreadyAlerted : new Set(alreadyAlerted || []);
  return thresholds.filter(t => pct >= t && !done.has(t));
}

module.exports = { salonMonthKey, recordTrinksCall, getTrinksUsage, newlyCrossed };
