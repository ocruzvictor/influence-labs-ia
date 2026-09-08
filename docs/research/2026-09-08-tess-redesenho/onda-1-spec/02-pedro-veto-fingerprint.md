# 1.2 Pedro — veto-check + fingerprint do fluxo **alvo**

**Persona:** @pedro-valerio  
**Base:** delta `01-pedro-delta-fluxo-lock.md` · blueprint 03/09 (não redo 23 etapas)  
**Processo:** inbound WhatsApp → commit Trinks (alvo Onda 1)

---

## Processo alvo (delta)

**Trigger:** inbound HMAC válido com intent booking  
**Saída:** copy da matriz do estado **e** (se cabe) Trinks 2xx antes de sucesso  
**Sistemas:** Kapso · Express · Tess 46589 · `booking_holds` · receipts · Trinks

| # | Etapa | Checkpoint | Veto | Owner desbloqueio |
|---|---|---|---|---|
| A | Oferecer slot | snapshot tem vaga? | sem vaga → copy sem horário | assembler |
| B | Copy PROPOSED | texto condicional? | verbo reserva → strip | sanitize worker |
| C | Hold | INSERT unique OK? | unique fail → ocupado; PG down → NFR-6 | `booking-holds` |
| D | Copy HELD | `hold_id` ativo? | sem row → strip process-promise | sanitize |
| E | Staff no fio | receipt existe? | silence **não** release; COMMITTING bloqueado sem approved | Martelo |
| F | COMMITTING | tag+guards+hold held? | qualquer false → 0 POST | guards + holds |
| G | POST | 2xx SKU/id? | não → FAILED; sem copy sucesso | 2-phase |
| H | Outbound sucesso | estado CONFIRMED? | senão → `selectOutboundBlocks` descarta | 2-phase |

### Veto conditions existentes (reuso)

HMAC · kill · denylist · timeout · empty · 2-phase · guards — **permanecem**.

### Veto conditions novas

| Etapa | Gap 03/09 / T2 | Veto agora | Dentes? |
|---|---|---|---|
| Oferta horário | Δ-1 / Δ-2 | C + D | sim (unique + strip) |
| F5 HOLD_COPY | Δ-1 | D — string proibida | sim |
| F3×F5 | Δ-3 | E — silence ≠ release | sim |
| Promessa processo | Δ-4 | B/D lexical | sim |
| Handoff sem dono | G-P5 | E — `assigned_to` ≠ “recepção” | sim |

**Resumo:** checkpoints alvo com veto = 8/8 no entorno da boca + commit.  
**Risco residual:** NFR-3 (Trinks UI).  
**Próximo passo:** spec schema + UX; não implementar.

---

## Fingerprint-check (handoffs da Onda 1)

| # | Check | Veredito |
|---|---|---|
| 1.1 Formato explícito | Hold request = `{phone, profissional_id, servico_id, slot_start}` | PASS |
| 1.2 Exemplo | ver schema 03 | PASS |
| 1.3 Compatível worker | Insert é worker, não LLM | PASS |
| 2.1 Proibições | HOLD_COPY e verbos lista FR-3 | PASS |
| 2.2 Nomenclatura | estados UPPER; last4 only em testes | PASS |
| 2.3 Regras booleanas | unique / 2xx / receipt.action | PASS |
| 3.1 Tom L0 | matriz copy; Tess redige dentro | PASS |
| 3.2 Registro | informal salão; sem “já confirmo” | PASS |
| 3.3 Anti-tom | process-promise, endereço pré-2xx | PASS |
| 4.x Marca | n/a visual; Tirra ≠ outro DNA | PASS |
| 5.1 Só esta etapa | Onda 2/3 fora | PASS |
| 5.2 Não pão inteiro | FDS não reaberto | PASS |
| 5.3 Próximo passo | QA critique → @sm depois | PASS |
| 5.4 Herança L0 | Syncra Martelo citado, não recopiado | PASS |
| 6.1 Journey log | hold row + receipt + operational event | PASS |
| 6.2 Fingerprints no log | `hold_id`, `receipt_id`, estado | PASS |

**Score:** 0 FAIL → ✅ PASS handoff spec  
**Migalha tratada para @dev (quando houver story):** este diretório `onda-1-spec/` + `requirements.json` — não o relatório FDS.

<promise>COMPLETE</promise>
