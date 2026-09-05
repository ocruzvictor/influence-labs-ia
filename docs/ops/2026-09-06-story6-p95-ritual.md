# Ritual — Story 6 AC3 p95 (duration_ms)

**Quando:** ≥1 dia **depois** de `683857d` live com tráfego info-open / allow `0007`.  
**Não:** novo PILOT · subir Nginx · apertar BOOKING abaixo do p95.

---

## 1. Rodar no VPS (container backend)

O script em `scripts/` **não** está na imagem Docker. Use o one-liner abaixo (lib `salao-cli-p95.js` **está** no container desde `5fd2cad`):

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
docker compose exec -T backend node -e "
const { medirP95TessTurn } = require('./lib/salao-cli-p95');
const db = require('./db');
medirP95TessTurn(db, { salonDay: '2026-09-06' })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => { console.error(e); process.exit(1); });
"
```

Alternativa no host (se `node` + `DATABASE_URL` disponíveis):

```bash
cd /opt/influence-labs/backend
node scripts/salao/observabilidade/medir_p95_tess_turn.js --live --dia 2026-09-06
```

---

## 2. Ler o JSON

| Campo | Significado |
|---|---|
| `ac3_overall` | `WAIT_TRAFFIC` · `PASS` · `ACTION_NEEDED` |
| `profiles[].p95_ms` | p95 do `duration_ms` naquele perfil |
| `profiles[].abort_cap_ms` | Teto atual (BOOKING/FULL = 22000 ms) |
| `profiles[].ac3` | `PASS` · `ADJUST_CAP` · `FAIL` · `INSUFFICIENT_DATA` |

**PASS (AC3):** BOOKING e FULL com `sample_ok` e `p95_ms ≤ abort_cap_ms`.

**ADJUST_CAP:** p95 entre teto atual e 24000 → subir `TESS_ABORT_MS_BOOKING` / `TESS_ABORT_MS_FULL` no env (nunca abaixo do p95).

**WAIT_TRAFFIC:** poucos turnos — rodar de novo no dia seguinte.

---

## 3. SQL manual (fallback)

```sql
SELECT
  payload->>'context_profile' AS profile,
  COUNT(*) AS n,
  ROUND(percentile_cont(0.95) WITHIN GROUP (
    ORDER BY (payload->>'duration_ms')::numeric
  )) AS p95_ms
FROM bot_operational_events
WHERE event = 'tess.turn'
  AND payload->>'salon_day' = '2026-09-06'   -- trocar
  AND COALESCE((payload->>'skipped_tess')::boolean, false) = false
  AND (payload->>'duration_ms') IS NOT NULL
  AND (payload->>'duration_ms')::numeric > 0
GROUP BY 1
ORDER BY 1;
```

---

## 4. Depois do PASS

- Marcar AC3 na story 6.
- Quinn re-gate opcional.
- Registrar em `docs/ops/nightwatch-log.md`.
