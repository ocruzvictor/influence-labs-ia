# Contexto de abertura — próxima sessão: validar com o Tiago (bot já ativo, sem go-live)

> Cole isto na **primeira mensagem** da nova sessão. Depois: `@aios-master`.
>
> Relatório completo (diagnóstico 14/08 + religação 15/08): `docs/ops/whatsapp-restricao-portfolio-studio-tirra-2026-08-14.md`
> Memória: `docs/ops/MEMORY-whatsapp-restricao-2026-08.md` + `.claude` `whatsapp-restricao-portfolio-2026-08.md`

## Objetivo desta sessão

**Não** abrir atendimento real a clientes no número novo.

1. Tiago testa o bot no `+55 11 95502-8331` (whitelist `5511937750330`).
2. Explicar **identidade do contato** (como o número aparece no WhatsApp do cliente) — ele vai perguntar.
3. Revisar o que ficou parado desde ~18/06 (prompt TESS 46589, KB, Trinks, horários, supervisor) e listar o que precisa atualizar **antes** de divulgar.
4. Só então decidir: dual estável (humano no antigo + bot no novo) vs tentar mover o `94831-9426`.

## Estado já fechado — não reabrir o diagnóstico nem o smoke de canal

Em 15/08/2026 o agente religou **fora** do portfólio preso:

- BM Influence Labs `394791787726671` (Victor, verificada).
- WABA `1342161271401600` — Qualidade da Conta limpa.
- Salvy `+55 11 95502-8331` Connected · Phone Number ID `1197799596760252`.
- Kapso → `POST /webhook/kapso` → TESS **46589**.
- Smoke `5511964540007`: inbound + resposta no WhatsApp confirmados.
- Recepção humana dos clientes: **ainda** `+55 11 94831-9426` no app.
- Humano no número da API: **Inbox Kapso** (Chatwoot dispensável neste caminho).

O bloqueio era o portfólio Studio Tirrá `1927873100853482`, não Kapso/Salvy/perfil Victor.

## IDs (copiar)

| Item | Valor |
|---|---|
| BM destino (viva) | `394791787726671` Influence Labs |
| WABA nova | `1342161271401600` |
| Número bot | `+55 11 95502-8331` |
| Phone Number ID | `1197799596760252` |
| Page signup | `188248578771184` Influence Labs |
| WhatsApp pessoal Victor (não misturar) | `329335672535990` |
| Portfolio preso | `1927873100853482` |
| WABA antiga / phone antigo | `1318541913020004` / `1016003164939443` |
| Número recepção (app) | `+55 11 94831-9426` |
| WABA teste morta 14/08 | `1795368298430447` |
| Case Meta | `27264844826545686` |
| Webhook | `https://api.studiotirra.com.br/webhook/kapso` |
| VPS | `deploy@72.60.155.118` · `/opt/influence-labs/infra` |

## Regras

- `BOT_ACCEPT_ALL=false` até go-live explícito.
- **Neste portfólio preso NÃO:** reivindicar teste Meta, cadastrar número, criar WABA, excluir o app do `94831`.
- **Não** misturar com `feature/bot-46589-ajustes-resposta` a menos que o teste do Tiago peça código.
- Display name ainda pendente na Meta (*minor limitations*) — não tratar como incidente.

## Aviso 15/08 — mensagem proativa ao Tiago

Tentativa de envio da IA para `5511937750330` via Kapso: **422** — *Cannot send non-template messages outside the 24-hour window*. A WABA nova não tem templates (`message_templates` vazio). Ele precisa mandar qualquer texto para `95502-8331` (ou a Victor encaminha o resumo pelo WhatsApp pessoal) para abrir a janela.

### Texto 1 — Victor → Tiago (WhatsApp pessoal, hoje à noite)

```
Tiago, boa noite — lê amanhã com calma.

A IA do salão voltou. Ainda não atende cliente. Número de testes: 11 95502-8331.

Amanhã manda só "oi" pra esse número. Ela responde. Recepção dos clientes continua no 94831.

Qualquer coisa me chama.
```

### O que o Tiago manda amanhã

Para **11 95502-8331**: `oi`

### Texto 2 — IA → Tiago (depois do oi; janela 24h aberta)

Cola no Inbox Kapso **nessa conversa** ou pede `@aios-master` “tiago mandou oi, dispara o briefing”:

```
Oi Tiago! Aqui é a secretária de IA do Studio Tirrá.

Boa notícia: o maior bloqueio da Meta no WhatsApp do salão foi resolvido. Estou ativa neste número.

A recepção dos clientes continua no 11 94831-9426. Ainda não atendo o público por aqui.

Nos próximos dias a Victor te chama pra alguns testes e pra ver se, nesse tempo parada, algo precisa ser ajustado. Pode ficar tranquilo — o caminho técnico voltou.

Quando puder, responde "ok" nesta conversa.
```

**Nota:** o TESS 46589 também responde sozinho ao “oi” (saudação de secretária). O Texto 2 é o recado de status; pode ir em seguida no Inbox.

## Identidade do número / contato (pendente — Tiago vai querer saber)

Hoje o cliente que salvar `95502-8331` **não** vê o cartão antigo do salão.

| O que o cliente vê | Estado 15/08 |
|---|---|
| Número | `+55 11 95502-8331` (Salvy, virtual) — **outro** que o `94831-9426` |
| Display name | Ainda **não aprovado** pela Meta. Kapso: *minor limitations*. Pode aparecer “Influence Labs” ou genérico até aprovar “Studio Tirrá” (ou o nome que pedirem). |
| Foto / about | Conferir no Gerenciador do WhatsApp / Kapso Phone numbers. |
| @username | Não claimed (havia botão Claim username). |
| Page âncora | Influence Labs `188248578771184` — não é a Page do salão. Não afeta o chat, afeta ads. |
| WABA / BM | Conta WhatsApp “Influence Labs”, não “Studio Tirrá”. |

Amanhã: abrir o perfil como o cliente vê (salvar o contato num celular de teste) e anotar print. Só então decidir se pede display name “Studio Tirrá” e se isso passa na verificação (WABA é da Influence Labs).

## Checklist sugerido com o Tiago

1. Ele manda `oi` e um pedido de agendamento/cancelamento do `0330` para `95502-8331`.
2. Conferir Inbox Kapso + logs `docker logs backend`.
3. Anotar o que a IA errou ou ficou datado (preços, profissionais, horários, tom).
4. Decidir go-live do número novo **só depois** dessa lista.

## Orquestração

- `@aios-master` coordena.
- `@dev` se o teste exigir ajuste de prompt/código.
- `@devops` só se env/VPS/webhook mudar.
- `@architect` só se reabrir Kapso vs Meta direto (não necessário: Kapso está no ar).
