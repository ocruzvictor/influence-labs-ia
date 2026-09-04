# Task: handoff-triage-wave

task: handoff-triage-wave
responsavel: "@floor-lexicographer"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - catalog_path (floor-lexicon-catalog-v*.md)
  - coverage_report (floor-keyword-coverage-*.md)
  - mira_sample (opcional — output audit-floor-quality de tess-nightwatch)
  - gate_status (corpus-quality-gate PASS required)
Saida: |
  - handoff_pack: docs/analysis/floor-lexicon-handoff-onda2-{YYYYMMDD}.md
  - architect_inputs: { synonyms[], intent_rules[], context_exclusions[], metrics_proxy[] }
Checklist:
  - "[ ] Gate Quinn PASS documentado"
  - "[ ] Sinónimos com termo_cliente → keyword → SKU (sem código)"
  - "[ ] Lista explícita do que NÃO entra no contexto (encaixe-only, landing, FAQ)"
  - "[ ] Métrica proxy: turnos user até booking/handoff/silêncio"
  - "[ ] Zero paste 46589; zero Trinks POST"
  - "[ ] ACK Victor pendente marcado no header"

## Objetivo

Contrato de entrada para **Onda 2 — triagem recalibrada** (@architect → @dev). Fase A = código; Fase B = prompt só com gate Victor.

## Workflow

1. Verificar `gate_status` = PASS em `corpus-quality-gate`. Se FAIL → **VETO**, não handoff.
2. Consolidar de `catalog_path` + `coverage_report`:
   - **Sinónimos** para `filterServicesByKeywords` / intent
   - **Regras intent**: SCHEDULING sem SKU ≠ UNCERTAIN dump
   - **Context exclusions**: quando fala é só encaixe/prof/FAQ — reforçar P-BUDGET, não aumentar FULL
3. Documentar **o que NÃO colocar no contexto**:
   - Landing "vim pelo Studio Tirra" sem SKU ainda
   - Falas só dia/hora sem serviço
   - FAQ operacional (PIX, endereço) — rota FAQ, não catálogo completo
4. Definir métrica proxy Onda 2: msgs user até `booking.created` | `handoff.human` | silêncio 24h
5. Incorporar notas Mira se `mira_sample` existir (padrões que funcionaram vs falharam).
6. Escrever `handoff_pack` com seções:
   - Executive summary (3 bullets)
   - Synonyms table
   - Intent recalibration rules
   - Context budget exclusions
   - Out of scope (crédito, 46589 split, CRM funil, BOT_ACCEPT_ALL)
   - **ACK Victor required** antes de @architect executar

## Veto conditions

- Handoff sem gate PASS → **VETO**
- Pacote inclui diff de prompt 46589 → **VETO** (Fase B separada)
- Sugere religar bot → **VETO** (decisão Victor à parte)

## Handoff

→ Victor (ACK)
→ @architect com `handoff_pack` após ACK
→ @data-engineer para métrica proxy

DONE quando `handoff_pack` completo, ACK pendente explícito, zero código alterado.
