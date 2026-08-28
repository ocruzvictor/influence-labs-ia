# Runbook: Kapso Log Search — go-live Studio Tirrá (bot 97504-0517)

**Quando usar:** Primeiro dia com volume real no bot TESS (+55 11 97504-0517). HMAC 401, send 4xx, webhook que não entrega, transcript de áudio falhando.

**Fora de escopo:** Kapso Findings, Kapso Agent, `BOT_ACCEPT_ALL`, número humano +55 11 94831-9426, alterações em `backend/server.js`.

---

## Onde clicar no painel

1. Abrir [app.kapso.ai](https://app.kapso.ai).
2. Selecionar o **projeto do bot** vinculado ao número **+55 11 97504-0517** (Dedicated / TESS 46589).
3. Menu lateral → **Logs**.
4. Usar:
   - **Problems** — checkbox/filtro “somente problemas” (equivale a `problems_only=true` na API).
   - **Busca livre** — campo de texto para query (HMAC, 401, send, transcript, webhook, etc.).

> **GAP conhecido:** filtros HMAC e Problems **só mostram linhas quando algo falha**. Em happy path (mensagem whitelist OK), o painel pode parecer vazio em Problems — isso é esperado. Victor ainda precisa fazer um **pass no painel** (Logs → Problems, marcar checkbox) para validar a UI antes do go-live.

---

## Kapso vs VPS — quando usar cada um

| Situação | Onde olhar |
|---|---|
| HMAC rejeitado no webhook Kapso → Express | **Kapso** Log Search (`problems_only`, source webhook delivery / Meta webhooks) |
| Kapso API retornou 4xx ao **enviar** mensagem | **Kapso** Log Search (source API) |
| Webhook Kapso **não entregou** ao nosso Express | **Kapso** Log Search (source webhook delivery) + conferir entrega no painel |
| Falha de **transcript de áudio** (STT) | **Kapso** Log Search (query: transcript, audio, STT) |
| Bot **processou** a mensagem mas resposta errada / TESS / Trinks / lógica interna | **VPS** — logs do container backend |
| Confirmar send/receive após whitelist (happy path) | **VPS** primeiro; Kapso Problems só se houver falha |

**VPS (backend Express):**

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra && docker compose logs backend --since 30m
```

Procure linhas `[kapso]` (send/receive), erros TESS, Trinks, whitelist.

---

## Quatro consultas mínimas (painel ou API)

Use estas queries no painel (**Logs → busca livre**) ou via API. Marque **Problems** quando quiser só falhas.

| # | Cenário | Query sugerida | Sources (API) | `problems_only` |
|---|---|---|---|---|
| 1 | **HMAC rejeitado** (401 no nosso webhook) | `HMAC` ou `401` ou `signature` | Meta webhooks, webhook delivery | sim |
| 2 | **Kapso send 4xx** | `send` + `4` ou status `400`/`403`/`429` | API | sim |
| 3 | **Webhook delivery failure** (Kapso → Express) | `webhook delivery` ou `delivery failed` ou URL `api.studiotirra.com.br` | webhook delivery | sim |
| 4 | **Áudio / transcript failure** | `transcript` ou `audio` ou `STT` | API, flow | sim |

### API (alternativa ao painel)

```
GET/POST https://api.kapso.ai/platform/v1/log_search
```

Parâmetros principais:

- `query` — texto livre (mesmas strings da tabela acima).
- `problems_only` — `true` para equivalente ao checkbox Problems.
- `sources` — `API`, `Meta webhooks`, `flow`, `webhook delivery` (conforme a linha da tabela).

Autenticação: header `X-API-Key` com a key do projeto (mesma usada pelos scripts locais).

---

## Fallback: scripts locais (`observe-whatsapp`)

Se o painel ou a API não estiverem disponíveis, use os scripts legados (skill `observe-whatsapp`):

- `node scripts/api-logs.js` — logs de API externa (send 4xx, etc.).
- `node scripts/webhook-deliveries.js` — tentativas de entrega de webhook.

**Path preferido:** painel Logs ou `log_search` API. Scripts são **fallback**.

---

## Ensaio pré-go-live (AC3)

| Campo | Valor |
|---|---|
| **Data** | 28/08/2026 |
| **Quem** | Victor (5511964540007, whitelist) |
| **Ação** | Enviou `"olá"` para **+55 11 97504-0517** |
| **Resultado VPS** | Backend log: `[kapso] send → 200` (happy path) |
| **Kapso Log Search** | Sem linha em **Problems** (esperado — nada falhou) |
| **BOT_ACCEPT_ALL** | Não utilizado |

**Pendência Victor (painel):** abrir Logs → marcar checkbox **Problems** e confirmar que a UI responde (mesmo que vazia em happy path). Ensaio de falha real (HMAC 401, etc.) só aparece quando ocorrer erro de produção.

---

## Referências

- Story: `docs/stories/salon-whatsapp-kapso-log-search-runbook.md`
- Pesquisa: `docs/research/2026-08-28-tess-workspace-id-kapso-findings/` §2.3
- Skill: `.claude/skills/observe-whatsapp/SKILL.md`
