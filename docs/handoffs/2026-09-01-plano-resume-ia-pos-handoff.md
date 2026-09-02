# Handoff: retomada ativa da IA após handoff

**Data:** 2026-09-01 (rev. 2 — squad de planejamento)  
**De:** @aios-master (Orion)  
**Squad:** [Atlas](analyst) · [Morgan](pm) · [Aria](architect) · [Pax](po) · [Uma](ux) · [Dara](data-engineer)  
**Para:** @sm (*create-story*) → @dev (Composer 2.5 Fast) → @qa  
**Status:** GO — Victor confirmou as 4 decisões em 2026-09-01 (rev. 3)  
**Incidente canônico:** Bianca pediu agendamento; IA emitiu `HANDOFF_HUMAN`; prompt posterior passou a permitir teste de mecha; janela Meta 24h ainda aberta; Tiago não tinha como mandar a IA voltar.

## Problema

Hoje o handoff é só passivo. A IA pede ajuda, silencia a thread (`humanHandledUntil` em memória, TTL ~6h) e notifica o Tiago: *“abre o WhatsApp do salão”*. Se ele responde na conversa da cliente pelo Business App, o backend marca takeover de novo. Não existe comando para: limpar o silêncio, injetar orientação de operador e **enviar** a próxima fala da IA enquanto a janela de 24h está aberta.

Dois silêncios divergem: Map de handoff (volátil) vs whitelist `human_only` do admin (persistente). Restart do backend já apagou silêncio em smoke.

## Decisões de produto (GO — travadas)

Victor: `GO` em 2026-09-01. As quatro recomendações estão **fechadas**.

| # | Pergunta | GO recomendado | Efeito do pedido de hoje |
|---|----------|----------------|--------------------------|
| 1 | Onde o Tiago manda o comando por mensagem? | Só no ping de ajuda (thread dele com o número do salão). **Nunca** na thread da cliente. | Confirma. “Respondendo no pedido de ajuda” = jornada A, não o chat da Bianca. |
| 2 | Nota de orientação | **Obrigatória**, 20–500 chars. Sem nota a IA retoma no escuro e pode repetir o handoff. | Confirma. O caso Bianca *é* a nota (“agenda o teste de mecha”). |
| 3 | Janela 24h fechada | Falha visível (`window_closed`). Não envia. Nota fica pendente para o próximo inbound da cliente (TTL 30 min). Sem template Meta. | Sem evidência nova. Mantém recomendação. |
| 4 | Quem pode retomar | Admin autenticado (Tiago + recepção). WhatsApp: só PIN de dono (`isOwnerPhone`). | Confirma. Recepção não comanda por WhatsApp. |

**Travado.** Sem reabrir no *create-story*.

## Comando único (CLI First)

Fonte da verdade: módulo `resumeConversation` no backend. WhatsApp e UI só chamam. Constitution Art. I: o `curl` fecha o caso Bianca **sem** UI e **sem** WhatsApp.

```bash
curl -sS -X POST \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"Retoma. Agenda o teste de mecha — obrigatorio, independente da venda consultiva.","actor":"cli"}' \
  "https://<host>/admin/conversations/55XXXXXXXXXXX/resume"
```

**Efeito atômico (opção A — Aria):**

1. Gate: nota válida; `block` → 409; `human_only` → **409** (não auto-limpa whitelist); outbound humano recente (`origin != cloud_api`, default 10 min) → 409.
2. Limpa silêncio de handoff (`bot_thread_state.silenced_until`) daquele telefone. **Não** altera `bot_whitelist`.
3. Persiste a nota como contexto de operador (nunca bolha WhatsApp da cliente, nunca `role=user` dela).
4. Janela 24h: `MAX(created_at)` em `conversation_history` onde `role=user` — **incluindo** `agent='passive'` (inbound no silêncio ainda abre a janela Meta; `agent <> 'passive'` exclui rows `NULL` e gera falso `window_closed`).
5. Se janela aberta: turno TESS com `source: 'operator_resume'` — bloco `ORIENTACAO_OPERADOR` no contexto dinâmico (mesmo padrão de `INTERLOCUTOR: TIAGO`). Sem fake turn. Envia via Kapso. Persiste só o `assistant`.
6. Se janela fechada: `window_closed`; nota pendente até próximo inbound ou TTL 30 min.
7. Audit `conversation.resume` + eventos `resume.requested` / `sent` / `window_closed` / `failed`.

**Ruling Orion (conflito squad):** o rascunho v1 pedia limpar `human_only` “se for o mesmo fluxo”. Aria + Dara vetam — não existe “mesmo fluxo” no modelo e mistura kill-switch com handoff. Resume **nunca** muta whitelist. Operador tira `human_only` em `/toggles`.

Idempotência: mesmo `phone` + mesma nota normalizada em &lt; 15s devolve o primeiro resultado. Nota diferente substitui; reenvia só se ainda não houve outbound `cloud_api` pós-resume. Lock `SELECT … FOR UPDATE`.

Contrato HTTP (Aria): `200` com `status: sent | window_closed | already_active`; `400` validação; `401` token; `409` human_spoke / human_only / blocked; `422` TESS falhou ou re-handoff (silêncio reposto); `503` Kapso falhou.

## Superfícies

### WhatsApp (thread do dono)

Redesenhar `notifyTiagoHandoff`. Copy (Uma): telefone copiável, motivo, última msg, **como responder NESTE chat**, e *não* “abre o WhatsApp do salão”.

Parser **estreito** no inbound `isOwnerPhone`, **antes** de `processMessage` do dono: âncora `retomar|retoma|volta a ia|pode voltar` + nota. Exceção deliberada e mínima à story `salon-whatsapp-tiago-owner-access`. Sem slash genérico (preço, KB, prompt).

Desambiguação: 0 pendentes → recusa; 1 → implícito; N → pedir telefone/nome, listar pendentes, **não** chamar TESS.

Exemplos: `retomar Bianca. Agenda o teste de mecha — obrigatório, independente da venda consultiva.`

### Admin (`/conversas/[phone]`)

**Adicionar** diálogo **Retomar IA** na sidebar (Uma). Stub “Adicionar nota” **permanece stub** — não vira CRM. “Pausar bot” (`human_only`) e “Bloquear” ficam como estão.

Estados: enviado / janela fechada (nota guardada) / erro TESS / já ativa / recusa humano recente / `human_only` / `block`. Textarea 20–500. BFF com sessão → `BACKEND_INTERNAL_TOKEN`. Mesmo POST.

## Dados (Dara)

Tabela nova `bot_thread_state` (PK `phone`). **Não** colunas em `bot_whitelist` nem em `conversation_history`. Migration expand `infra/migrations/016_bot_thread_state.sql` — não aplicada neste handoff.

- `silenced_until` + `silence_reason` (`handoff` \| `business_app`) — TTL é o timestamp, não um reason `ttl`
- `last_handoff_at`, `last_handoff_motivo`
- `resume_note`, `resume_note_set_at`, `resume_note_expires_at`, `resume_note_consumed_at`
- `last_resume_at`, `last_resume_actor`, `last_resume_result`, `last_resume_note_hash`
- Cache por telefone TTL 5s, **fora** do scan de `bot-state.js`
- Dual-write Map → tabela → contract (remove Map)
- Audit: reusar `admin_audit_log` + `bot_operational_events`

## Arquitetura (Aria — opção A)

Rejeitado: reusar whitelist (B) e `processMessage` sintético com a nota como se fosse a cliente (C — vaza).

Nota no TESS: bloco no user envelope, separado do histórico da cliente. Filtro de overlap pós-TESS (se a fala copiar 40+ chars da nota, não envia, re-silencia).

Persistir `last_staff_outbound_at` no webhook de takeover — senão o gate `human_spoke_recently` morre no restart.

## Segurança e anti-goals

- Orientação **nunca** vai para o WhatsApp da cliente.
- Comando na thread da cliente é ignorado (e não deve ser ensinado): Business App = takeover.
- Sem auto-clear de `human_only` / `block`.
- Sem slash-commands genéricos.
- Sem reescrever prompt de mecha / 46589 neste epic.
- Sem `ADMIN_TOKEN` no browser.

## Sequência de stories (Pax — 26 pts)

| ID | Story | Pts | Depende |
|----|-------|-----|---------|
| resume-ia-1 | Persistência `bot_thread_state` (troca o Map) | 5 | — |
| resume-ia-2 | CLI/API + envio proativo + janela 24h | 8 | #1 |
| resume-ia-3 | WhatsApp: ping + parser no thread do dono | 5 | #2 |
| resume-ia-4 | Admin: diálogo Retomar IA | 5 | #2 |
| resume-ia-5 | Smoke Bianca + telemetria `resume.*` | 3 | #2–4 |

1 → 2 sequenciais. 3 e 4 em paralelo depois de 2. Dex **não** começa pelo botão.

Métrica Bianca (Morgan): 1 outbound Cloud API na janela; nota invisível; fala orienta agendar teste de mecha (não só “estou de volta”).

## OUT

- Fila de retomada depois de 24h (V2: template Meta).
- Botões interativos no ping.
- Notas livres de CRM.
- Mudança de prompt 46589 / teste de mecha.
- Parser na thread da cliente.
- Lista extra de operadores no WhatsApp.
- Resume como inverso genérico de “Pausar bot”.
