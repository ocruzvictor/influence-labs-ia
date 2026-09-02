# EPIC: Retomada ativa da IA após handoff

**Status:** Stories 1–5 Done (story 5 QA CONCERNS — roteiro pronto; smoke live VPS pendente)  
**Criado em:** 2026-09-01  
**Rev. 3:** 2026-09-01 — GO Victor; design Atlas/Morgan/Aria/Pax/Uma/Dara sob @aios-master  
**Owner:** @dev (story 5) · gate @qa  
**Handoff:** [docs/handoffs/2026-09-01-plano-resume-ia-pos-handoff.md](../../handoffs/2026-09-01-plano-resume-ia-pos-handoff.md)  
**Incidente:** Bianca / teste de mecha — IA pediu ajuda, prompt novo saiu depois, janela 24h aberta, operador não conseguiu mandar a IA voltar.

## Objetivo

O operador (Tiago no WhatsApp; Tiago/recepção no admin) consegue **ordenar que a IA retome** uma conversa silenciada por `HANDOFF_HUMAN`, com uma nota de orientação que **não** aparece para a cliente, e a IA **envia** a próxima mensagem se a janela Meta de 24h estiver aberta.

## Personas

| Persona | Superfície | Job |
|---------|------------|-----|
| Tiago (dono) | Ping de handoff no WhatsApp + admin | Retomar a IA sem abrir o chat da cliente no Business App |
| Recepção | Admin `/conversas/[phone]` | Mesmo comando, no turno |
| Cliente | Só vê a fala da IA | Continuidade natural, sem vazamento de “orientação do dono” |

## IN

- Comando CLI/API único (`POST /admin/conversations/:phone/resume`).
- Persistência de silêncio + nota em `bot_thread_state` (hoje o Map some no restart).
- Envio proativo Kapso quando a janela está aberta (turno `operator_resume`, sem fake `role=user`).
- Parser estreito no thread do dono (exceção à story owner-access).
- Copy nova do ping de handoff (não ensinar Business App da cliente).
- Botão **Retomar IA** no drill-down do admin (stub “Adicionar nota” permanece stub).
- Eventos `resume.*` e audit.

## OUT

- Slash-commands genéricos (KB, preço, prompt).
- Comando digitado na thread da cliente.
- Unificar `human_only` da whitelist com silêncio de handoff; resume **não** auto-limpa whitelist.
- Templates Meta para janela fechada (V2).
- Reescrita do prompt de mecha.
- CRM de notas livres.

## Stories (draft @sm 2026-09-01)

| # | Story | Depende | Pts | Pode executar agora |
|---|-------|---------|-----|---------------------|
| 1 | [Persistência `bot_thread_state`](../salon-whatsapp-resume-ia-1-persistencia.md) | — | 5 | ✅ Done (QA CONCERNS aceite) `[closure-key: resume-ia.1:digest:working-tree:016@a412ba3e,lib@16ffcc24,test@0b24ac98,rollback@da930c34,HEAD:468391d7]` |
| 2 | [CLI/API resume + janela 24h](../salon-whatsapp-resume-ia-2-comando-api.md) | #1 | 8 | ✅ Done (QA CONCERNS aceite) `[closure-key: resume-ia.2:digest:working-tree:resume@96ddfe82,test@5e055b23,server@11a84db8,owner@36f917f2,assembler@d2ba8e1e,thread@488c8be5,audit@1175f94b,017@50014df8,rollback@c5f98937,thread-test@afac8793,HEAD:468391d7]` |
| 3 | [WhatsApp ping + parser dono](../salon-whatsapp-resume-ia-3-whatsapp-parser.md) | #2 | 5 | ✅ Done (QA PASS) `[closure-key: resume-ia.3:digest:working-tree:parser@a9864037,test@94423f68,server@1ec6066f,story@69b49061,HEAD:468391d7]` |
| 4 | [Admin diálogo Retomar IA](../salon-whatsapp-resume-ia-4-admin-dialog.md) | #2 | 5 | ✅ Done (QA PASS) `[closure-key: resume-ia.4:digest:working-tree:route@0693b1e6,dialog@dc0d858a,sidebar@e99d1680,test@918d0fdf,HEAD:468391d7]` |
| 5 | [Smoke Bianca-teste + `resume.*`](../salon-whatsapp-resume-ia-5-smoke-bianca.md) | #2 (CLI); #3+#4 (completo) | 3 | ✅ Done (QA CONCERNS — roteiro PASS; live VPS pendente) |

**Soma:** 26 pts. Ordem: **1 → 2 → (3 ∥ 4) → 5**. Story 5 Done (QA CONCERNS). Smoke live VPS ainda fecha o DoD operacional do epic.

## Critério de pronto (DoD do epic)

Honestidade QA 2026-09-02 — **unit/CLI local vs live VPS**. Live smoke **não** foi executado (sem `ADMIN_TOKEN`/`HOST`). Units stories 1–4 reportados por Dex (não reexecutados neste gate).

- [x] CLI resume — **unit** (`resume-conversation.test.js`, 25 casos; contrato POST/409/`window_closed`/`sent`). **Live VPS:** pendente.
- [ ] Caso Bianca reproduzível **live:** handoff → resume com nota de mecha → cliente recebe fala da IA. Roteiro §1 pronto (`docs/ops/smoke-resume-ia-pos-handoff-bianca-teste.md`). Execução VPS pendente.
- [x] Nota não vaza como `role=user` — **unit** (leak filter story 2). **Live SQL** no número de teste: pendente.
- [x] Restart não perde silêncio/nota — **unit** (`bot-thread-state.test.js`). **Live** `docker compose restart backend`: pendente.
- [x] Parser só no PIN / thread da cliente ignorada — **unit** (`owner-resume-parser.test.js`). **Live WhatsApp** §3: pendente.
- [ ] `@qa` gate **PASS** + CodeRabbit 0 CRITICAL. Gate story 5 = **CONCERNS** (live bloqueado, CR skip). Epic **não** está PASS live.

## Decisões (GO Victor 2026-09-01)

1. Comando WhatsApp **só no ping** (thread do dono). Nunca na thread da cliente.
2. Nota **obrigatória**, 20–500 caracteres.
3. Janela fechada: **falha visível + nota pendente** no próximo inbound (TTL 30 min). Sem template Meta.
4. WhatsApp: **só PIN de dono**. Admin: Tiago + recepção autenticados.

## Change Log

- 2026-09-01 — @sm (River): 5 stories draft ligadas; status Ready for Dev (story 1).
- 2026-09-01 — @po (Pax): close-story administrativo. Story 1 Done (QA CONCERNS aceite); story 2 pode executar. Sem transição de Status pelo PO. `[closure-key: resume-ia.1:digest:working-tree:016@a412ba3e,lib@16ffcc24,test@0b24ac98,rollback@da930c34,HEAD:468391d7]`
- 2026-09-02 — @po (Pax): close-story administrativo. Story 2 Done (QA CONCERNS aceite); stories 3 e 4 podem executar em paralelo. Sem transição de Status pelo PO. `[closure-key: resume-ia.2:digest:working-tree:resume@96ddfe82,test@5e055b23,server@11a84db8,owner@36f917f2,assembler@d2ba8e1e,thread@488c8be5,audit@1175f94b,017@50014df8,rollback@c5f98937,thread-test@afac8793,HEAD:468391d7]`
- 2026-09-02 — @po (Pax): close-story administrativo. Story 3 Done (QA PASS); story 5 ainda espera #4 no mesmo lote. Sem transição de Status pelo PO. `[closure-key: resume-ia.3:digest:working-tree:parser@a9864037,test@94423f68,server@1ec6066f,story@69b49061,HEAD:468391d7]`
- 2026-09-02 — @po (Pax): close-story administrativo. Story 4 Done (QA PASS); stories 1–4 Done; story 5 pode executar. Sem transição de Status pelo PO. `[closure-key: resume-ia.4:digest:working-tree:route@0693b1e6,dialog@dc0d858a,sidebar@e99d1680,test@918d0fdf,HEAD:468391d7]`
- 2026-09-02 — @qa (Quinn): story 5 gate CONCERNS → Done. DoD: units 1–4 vs live VPS separado. Smoke live e CodeRabbit 0 CRITICAL ainda abertos no epic. `[closure-key: resume-ia.5:digest:working-tree:smoke@d820c153,story@2c81387f,HEAD:468391d7]`

