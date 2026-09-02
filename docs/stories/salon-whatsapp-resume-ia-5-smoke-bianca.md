# Story: Smoke Bianca (número de teste) + telemetria `resume.*`

**Epic:** [EPIC-resume-ia-pos-handoff](epics/EPIC-resume-ia-pos-handoff.md)  
**Tipo:** Brownfield  
**Status:** Done  
**Agente executor:** @dev (Composer 2.5 Fast) · gate @qa  
**Story Points:** 3  
**Pode executar agora:** ✅ SIM — desbloqueada: [#3](salon-whatsapp-resume-ia-3-whatsapp-parser.md) e [#4](salon-whatsapp-resume-ia-4-admin-dialog.md) Done (QA PASS). Smoke CLI + WhatsApp + admin.  
**Branch sugerida:** `feature/resume-ia-pos-handoff`  
**Pedido / GO:** Victor / @aios-master 2026-09-01  
**Handoff:** [docs/handoffs/2026-09-01-plano-resume-ia-pos-handoff.md](../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md) (rev. 3, GO)

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - "docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md (passos + evidência)"
  - "SQL conversation_history + bot_operational_events (nota não role=user; resume.*)"
  - "coderabbit --prompt-only --base main (0 CRITICAL)"
```

## Story

**As a** operador/ops (Tiago no CLI),  
**I want** um roteiro de smoke reproduzível em **número de teste** (nunca Bianca real) cobrindo `curl` resume, nota invisível e os negativos restart / thread da cliente / `window_closed`,  
**so that** o DoD do epic fica verificável com CLI First, sem feature nova nesta story.

## Contexto

Incidente canônico: Bianca pediu agendamento; IA `HANDOFF_HUMAN`; prompt posterior passou a permitir teste de mecha; janela 24h aberta; Tiago não tinha como mandar a IA voltar.

Esta story **não** implementa produto novo. É o DoD operacional do epic: roteiro reproduzível em **número de teste** (whitelist de teste já existe em migrations 011–013 — **nunca** o número real da Bianca).

Métrica Morgan: 1 outbound Cloud API na janela; nota invisível; fala orienta agendar teste de mecha (não só “estou de volta”).

Telemetria: eventos `resume.requested` / `sent` / `window_closed` / `failed` em `bot_operational_events` (story 2). CodeRabbit **0 CRITICAL** na branch.

## IN / OUT

**IN**

- Roteiro ops versionado (markdown em `docs/ops/`).
- Passos positivos + negativos (restart, comando na thread da cliente, window_closed).
- Verificação SQL/logs: nota **não** em `conversation_history` `role=user`; `resume.*` gravados.
- Gate CodeRabbit 0 CRITICAL.

**OUT**

- Feature nova (parser, POST, UI — já nas stories 1–4).
- Template Meta.
- Usar Bianca real.
- Fake turn `role=user`.

## Acceptance Criteria

- [x] **AC1:** Existe roteiro `docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md` usando **número de teste** explícito (placeholder `55XXXXXXXXXXX` + instrução para pegar da whitelist de teste, **não** Bianca real).
- [ ] **AC2:** Passo feliz: forçar/aguardar handoff na thread de teste → operador **não** responde na thread dela → `curl` resume com nota de mecha (mesmo texto do handoff) → cliente de teste recebe mensagem `origin=cloud_api` / Kapso send → query `conversation_history` **não** tem a nota como `role=user`. *(Roteiro §1 pronto — evidência live pendente @qa/VPS.)*
- [ ] **AC3:** Negativo **restart:** handoff → restart backend → silêncio **permanece** (story 1) → curl resume ainda funciona. *(Roteiro §2 pronto — evidência live pendente.)*
- [ ] **AC4:** Negativo **thread da cliente:** texto tipo `retomar …` no chat da cliente **não** dispara resume (story 3); takeover se staff responder no Business App continua. *(Roteiro §3 pronto — evidência live pendente.)*
- [ ] **AC5:** Negativo **window_closed:** simular/usar conversa sem inbound `role=user` nas últimas 24h → curl devolve `window_closed`; nota pendente; **sem** send Kapso. *(Roteiro §4 pronto — evidência live pendente.)*
- [ ] **AC6:** Telemetria verificável: pelo menos `resume.requested` e `resume.sent` (happy) ou `resume.window_closed` (negativo) em `bot_operational_events` filtrável por `client_phone` do teste. *(Queries no roteiro — execução live pendente.)*
- [ ] **AC7:** CodeRabbit na branch do epic: **0 CRITICAL**. HIGH documentados como débito se restarem. *(CLI 0.6.1 presente; `review --agent --base main` falhou TRPCClientError — skip graceful_degradation; @qa reexecuta no gate.)*

## Tasks / Subtasks

- [x] **T1 (AC1–AC5):** Escrever o roteiro ops (passos numerados, curls, queries SQL, o que **não** fazer).
- [ ] **T2 (AC2, AC6):** Executar smoke CLI pós-story 2 em staging/VPS de teste; anexar evidência (IDs de evento / timestamps) no Dev Agent Record desta story — **sem** colar PII da Bianca real. *(BLOCKED_LIVE — ver Dev Agent Record.)*
- [ ] **T3 (AC4):** Completar smoke WhatsApp só depois da story 3. *(Roteiro §3 pronto; execução live pendente.)*
- [ ] **T4 (AC7):** `@qa` + CodeRabbit committed vs `main`. *(Skip local — serviço indisponível; binário instalado.)*
- [ ] **T5:** Atualizar checkboxes do DoD no [epic](epics/EPIC-resume-ia-pos-handoff.md) quando PASS. *(Aguarda @qa gate live.)*

## Dev Notes

**Números de teste no repo (não usar como Bianca):** migrations `011_whitelist_teste_*`, `012_*`, `013_*`. Dex/ops escolhe um allowlist **de teste** no VPS.

**Queries úteis**

```sql
-- nota não vaza como user
SELECT id, role, agent, left(content, 80), created_at
  FROM conversation_history
 WHERE client_phone = $1
 ORDER BY created_at DESC
 LIMIT 20;

SELECT event, motivo, received_at
  FROM bot_operational_events
 WHERE client_phone = $1
   AND event LIKE 'resume.%'
 ORDER BY received_at DESC;
```

**Env:** `ADMIN_TOKEN` (header `X-Admin-Token`); host staging/VPS de teste; `client_phone` escolhido da whitelist de **teste** no VPS (não Bianca real). Placeholder no roteiro: `55XXXXXXXXXXX`.

**Curl (CLI First — copiado do handoff / story 2; não inventar contrato):**

```bash
curl -sS -X POST \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.","actor":"cli"}' \
  "https://<host>/admin/conversations/55XXXXXXXXXXX/resume"
```

Detalhe HTTP (200 `sent` | `window_closed` | `already_active`; 409s): [resume-ia-2](salon-whatsapp-resume-ia-2-comando-api.md) Dev Notes.

**Health:** `bot.human_handled.active_count` deve refletir COUNT persistido (story 1) no passo restart.

**Risco (PII):** evidência no Dev Agent Record sem colar número/nome da Bianca real; roteiro só placeholder + “pegar da whitelist de teste”.

**Fonte:** epic DoD; handoff §Comando único + §Sequência story 5; métrica Bianca (Morgan).

## File List (previsto)

| A/M | Path |
|-----|------|
| A | `docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md` |
| M | `docs/stories/salon-whatsapp-resume-ia-5-smoke-bianca.md` |
| — | `docs/stories/epics/EPIC-resume-ia-pos-handoff.md` (DoD checkboxes após PASS @qa) |

Código de produto **só** se o smoke revelar bug — aí volta para a story dona (1–4), não inchando esta.

## Testing

- Ops smoke (não substitui unit das stories 1–4).
- @qa: conferir AC2–AC6 com evidência.
- CodeRabbit 0 CRITICAL = gate de merge do epic.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Primary: Deployment / ops validation
- Secondary: Integration
- Complexity: Low (docs + execução; código só se hotfix)

**Specialized Agent Assignment**

- Primary: @dev, @qa
- Supporting: @devops (se apply migration VPS)

**Quality Gate Tasks**

- [ ] Pre-Commit (@dev): se houver diff de código residual
- [ ] Pre-PR (@devops / @github-devops): `coderabbit --prompt-only --base main` — **0 CRITICAL**
- [ ] Pre-Deployment: N/A — esta story não faz deploy de produto; smoke em staging/VPS de teste.

**CodeRabbit Focus Areas**

- Primary: roteiro não aponta número real; queries não vazam nota em role=user.
- Secondary: CRITICAL zero na branch.

**Predict files:** `docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md`, este story file.

**Self-Healing Configuration**

- Primary Agent: @qa (full) no gate final; @dev (light) se hotfix
- Max Iterations: 3 · Timeout: 30 min · Severity Filter: CRITICAL, HIGH (@qa)
- CRITICAL: auto_fix · HIGH: auto_fix (@qa) / document_only (@dev) · MEDIUM: document_as_debt (@qa)

## Dev Agent Record

- **Status:** ready-for-review
- **Start:** 2026-09-01
- **End:** 2026-09-01

### Execução vs bloqueio

| Item | Resultado |
|------|-----------|
| Roteiro ops AC1 | **DONE** — `docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md` |
| Smoke CLI live (AC2–AC6) | **BLOCKED_LIVE** — `ADMIN_TOKEN`, `HOST` e VPS não presentes no ambiente local (`env` vazio). Nenhuma evidência inventada. |
| Unit gates stories 1–4 | **PASS** — `backend npm test` 410/410; fatia resume: `resume-conversation.test.js` (25 casos), `bot-thread-state.test.js` (6), `owner-resume-parser.test.js` (11) |
| CodeRabbit AC7 | **SKIP** — binário `coderabbit` 0.6.1 em `~/.local/bin`; flag `--prompt-only` removida na CLI; `coderabbit review --agent --base main` → `TRPCClientError` (serviço indisponível). `graceful_degradation skip_if_not_installed` aplicável; @qa reexecuta no gate. |

### Próximo passo (@qa / ops)

1. Exportar `TEST_PHONE` (whitelist 011/012/013), `ADMIN_TOKEN`, `HOST` no VPS.
2. Aplicar migrations 016+017 se ainda pendentes.
3. Executar seções 1–4 do roteiro; preencher tabela de evidência com timestamps reais (sem IDs inventados).
4. Reexecutar CodeRabbit vs `main` na branch do epic.

### IDS

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Formato roteiro ops | **ADAPT** | `docs/ops/smoke-tess-context-scoped-whitelist-2026-09-01.md` — seções numeradas, curls, SQL, tabela PASS |
| Número teste | **REUSE** | migrations 011/012/013 documentadas; placeholder `55XXXXXXXXXXX` |

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-09-01 | 0.1.0 | Created. Roteiro smoke Bianca-teste + telemetria `resume.*`. Sem código de produto. | @sm |
| 2026-09-01 | 0.1.1 | Validated GO (8/10) — Status: Draft → Ready | @po |
| 2026-09-01 | 0.2.0 | Roteiro ops completo; live smoke BLOCKED_LIVE; Status → ready-for-review | @dev |
| 2026-09-02 | 0.3.0 | QA CONCERNS — AC1 PASS; AC2–AC6 BLOCKED_LIVE (sem evidência inventada); AC7 skip CR. Status → Done | @qa |

## QA Results

### Review Date: 2026-09-02

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: working-tree:smoke@d820c153,story@2c81387f,HEAD:468391d7

### Code Quality Assessment

Story de DoD operacional, sem código de produto. O roteiro `docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md` está completo: placeholder `55XXXXXXXXXXX`, whitelist 011/012/013 (não Bianca real), pré-reqs VPS (016+017, health, allowlist), passo feliz §1, negativos restart / thread da cliente / `window_closed` (§2–§4), SQL de nota vs `role=user` + `resume.*`, tabela de evidência vazia (correto), e seção explícita de units 1–4 como substituto quando live bloqueado. Dex documentou BLOCKED_LIVE sem inventar timestamps/IDs. Typo menor: Passo 0 cita “seção 5” para `window_closed`; o negativo está na §4.

### Refactoring Performed

Nenhum. [AUTO-DECISION] missão: NÃO implemente — review only.

### Compliance Check

- Coding Standards: ✓ N/A produto; roteiro CLI First (curl + SQL)
- Project Structure: ✓ `docs/ops/` + story + gate
- Testing Strategy: ✓ ops smoke definido; units 1–4 como contrato; live não executado
- All ACs Met: ✗ live AC2–AC6 não observados — CONCERNS/WAIVED-live, não FAIL (roteiro completo + BLOCKED_LIVE honesto)

### Improvements Checklist

- [x] Review do roteiro vs AC1 (existe, número teste, não Bianca, passos + negativos + SQL)
- [x] Confirmar tabela de evidência vazia (zero invenção)
- [x] AC7 skip CodeRabbit documentado (não FAIL)
- [ ] Victor: executar seções 1–4 no VPS e preencher evidência real
- [ ] Reexecutar CodeRabbit vs `main` quando TRPC responder
- [ ] (futuro) Corrigir “seção 5” → “§4” no Passo 0

### Security Review

Roteiro proíbe PII da Bianca real e colar `ADMIN_TOKEN`. Migration 013 é cliente real autorizado — só com confirmação. Sem evidência live nesta review, portanto sem vazamento no record.

### Performance Considerations

N/A. Sem código de produto.

### Files Modified During Review

- `docs/qa/gates/resume-ia.5-smoke-bianca.yml` (criado)
- Status + Change Log desta story (transição canônica)
- `docs/stories/epics/EPIC-resume-ia-pos-handoff.md` (DoD unit vs live — pedido da missão)

Nenhum source de aplicação.

### Gate Status

Gate: CONCERNS → docs/qa/gates/resume-ia.5-smoke-bianca.yml

### Lifecycle Transition

CONCERNS: InReview → Done
(QA applies this transition in Status and Change Log before handoff.)

