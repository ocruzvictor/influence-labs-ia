# Lib Forge — analysis-only (LF-G001)

**Persona:** @lib-forge · profile **analysis-only**  
**Fonte:** `docs/analysis/2026-09-03-lib-forge-oportunidades-tess.md`  
**Regra:** zero `.py` · zero publish · zero mutação Trinks  

---

## Escopo desta rodada

Lib Forge **não** estava no hot-path FDS. Esta sessão **reusa** OP001–018 como mapa de automação **determinística** (0 crédito Tess) — não como fix de I1.

---

## Oportunidades por relevância ao redesenho

### Tier 1 — Fecham observabilidade do commit (pré-requisito A/B)

| ID | Nome | Tipo | Por que importa pós T1/T2 |
|---|---|---|---|
| OP002 | Medir orçamento contexto | CLI wrap | Prova se split FAQ/BOOKING reduz tok **antes** de split agente |
| OP004 | Simular perfil contexto | CLI wrap | Golden 0-crédito por perfil — baseline copy vs tag |
| OP005 | Patrulha stuck (wrap) | CLI | G-P7 — separar block de stuck real |
| OP006 | Verificar ledger vs histórico | CLI | Detectar “falou confirmado, 0 POST” **offline** |
| OP007 | Listar órfãos booking | CLI | Casos César/Gabriel/Denise pattern |

### Tier 2 — Suportam Opção A (lock + estados)

| ID | Nome | Tipo | Uso |
|---|---|---|---|
| OP001 | Consultar horários disponíveis | integração | SOT snapshot antes de hold |
| OP003 | Classificar intenção | validação | Regression intent vs mute FAQ |
| OP018 | Pipeline classificação batch | automação | Replay corpus **sem** reler FDS na sessão ops |

### Tier 3 — Pós go-live futuro (não agora)

| ID | Nome | Nota |
|---|---|---|
| OP010–OP016 | Nightwatch / token / golden extended | Observabilidade custo |
| OP017 | Agregar context_bytes | Depende evento persistido — blueprint disse **não** nesta leva |

---

## O que Forge **não** resolve

| Gap T2 | Forge? | Motivo |
|---|---|---|
| Hold TTL inventário | ❌ | Requer hot-path + schema — worker consulta só **lê** |
| F5 copy sem POST | ❌ | 2-phase é runtime Express |
| F3×F5 handoff | ❌ | Processo + UI Martelo |
| Troca modelo | ❌ | Painel Tess |

---

## Heurística LF-G001 aplicada

```
IF ação.muta_trinks OR ação.call_tess_execute:
  → FORA do Forge analysis-only
ELIF ação.lê_snapshot OR ação.simula OR ação.patrulha:
  → OP candidata (Tier 1–2)
```

---

## Reuso vs derrubar (Forge)

| Reusar | Derrubar |
|---|---|
| OP001–007 como **kit de diagnóstico** pré-ACK redesign | Regenerar scripts (`*generate-scripts`) nesta sessão |
| Estrutura `backend/scripts/salao/` proposta | Forge como **runtime** booking |
| `tess-domain-addendum` (0 LLM nos workers) | OP017 persist event até decisão arquitet |

---

## Próximo passo Forge (somente pós-ACK Victor)

1. Victor escolhe opção arquitetural (menu §05)  
2. `@lib-forge *analyze` focado nas OPs Tier 1 da opção  
3. `@dev` implementa **só** workers aprovados — **não** Orion nesta sessão  

---

*Lib Forge · LF-G001 analysis-only · 2026-09-08*
