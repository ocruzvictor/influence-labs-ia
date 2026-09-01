# Workplan — performance de tokens TESS (arrumar primeiro, crédito depois)

**Data:** 2026-09-01 · **Orquestração:** @aios-master (decisão Victor)  
**Status:** S0–S2 implementados em `feature/tess-context-on-demand` — **não** é go-live. Próximo: S3 com 1.000 cr.
**Orçamento TESS desta sessão:** **1.000 créditos avulsos (R$ 84,50)** só para validar a versão nova

## Premissa invertida (acordada)

Não comprar crédito para atender clientes na versão atual (~29 cr/msg). Essa versão vai ser morta.  
Sequência: **medir → cortar contexto → gastar os 1.000 cr na versão nova → só então liberar clientes aos poucos.**

Até 06/set o plano de 4.000 **não** precisa cobrir o salão. Precisa sobrar cérebro para o corte.

Confirmação de pack: **1.000 créditos**, não R$ 1.000 (isso seriam ~11,8k créditos). Se a compra for em reais, avisar.

## O que os 1.000 créditos aguentam

| Como gastar | Msgs aproximadas | Serve para |
|---|---:|---|
| Versão **atual** (~29 cr) | **~34** | Quase nada — **não gastar assim** |
| Versão **nova** (alvo 4–8 cr) | **~125–250** | Golden + smoke whitelist |
| A/B 12 golden × FULL + SCOPED no dump gordo | **~24 × 29 = 696** | **Proibido** neste orçamento |

Baseline FULL já está medido (`GET /workspaces/usage`, 154 execuções). Não repetir.

Reserva sugerida dos 1.000:

| Fatia | Cr | Uso |
|---|---:|---|
| Camada 0 (unit / mock / tamanho de contexto) | **0** | Obrigatório antes de queimar crédito |
| 12 golden só em `scoped` | **~80–180** | Qualidade da versão nova |
| 10–15 msgs whitelist reais | **~50–120** | Smoke humano |
| Folga / retries | resto (~700) | Não abrir para clientes |

Se o golden `scoped` ainda sair ~25+ cr/msg, **parar** e voltar ao classificador — não queimar o pack em piloto de cliente.

## Sessão de trabalho (ordem)

### S0 — Contabilidade local (0 crédito) — feito

Instrumentar **antes** de chamar TESS: tamanho em chars/tokens aproximados de cada bloco (`HORARIOS`, `SERVICOS`, `HABILITACAO`, `PROFISSIONAIS`, `HISTORICO`, prefixo).

Entrega: tabela “onde estão os 50k tokens” com 1 fixture de `oi` e 1 de `quero cortar amanhã`.  
Gate: sabemos o % de slots vs catálogo **sem** gastar TESS.

Arquivos: log em `processMessage` / helper; evento `tess.context_bytes`. Spec: `docs/architecture/tess-context-on-demand.md` Fase 0.

### S1 — Skip allowlist (economia permanente, 0 crédito extra) — feito (default OFF)

Só frases fechadas no **1º turno**, histórico vazio: `oi`, `olá`, `bom dia/tarde/noite`, `obrigado(a)`, `valeu`.  
Composto (`oi quero cortar`) **sempre TESS**. Default de produção pode ficar shadow; em **dev/whitelist de teste** pode ligar skip para não gastar os 1.000 em “oi”.

Gate @qa: FPR — `"oi quero cortar amanhã"` nunca skip.

### S2 — Contexto por intenção (o corte grande) — flag `scoped` — feito (default `full`)

Classificador determinístico → perfis MIN / FAQ / PRICE / BOOKING / CANCEL / FULL.  
Na dúvida → **FULL** (qualidade).  
Default produção: `TESS_CONTEXT_MODE=full` até o golden passar.

Não implementar skip de TESS em massa nesta fase (já coberto em S1 allowlist).

### S3 — Gastar os 1.000 cr (só `scoped`)

1. `cd backend && npm test`  
2. 12 casos de `scripts/test-conversa-v3.mjs` **com** contexto já filtrado (não dump 10 dias)  
3. Anotar `responses[].credits` + tokens  
4. Smoke whitelist: 1 FAQ, 1 preço Tiago, 1 agendamento curto  

**Pass:** média golden `scoped` **bem abaixo** de 29 (meta de estudo: tendência a &lt; 10; meta de go-live futuro: &lt; 4 — pode não cair nisso nesta sessão).  
**Fail:** ainda ~20+ cr → não liberar cliente; iterar filtro de slots (BOOKING 1–3 dias).

### S4 — Liberação gradual (depois, outro pack ou renovação 06/set)

Só se S3 passar qualidade (R1 preço único, tags booking, expediente).  
Dimensionar crédito de atendimento **com o cr/msg medido em S3**, não com 29.

## Fora desta sessão

- Trocar Haiku  
- `BOT_ACCEPT_ALL`  
- Comprar 5.000/15.000 para cobrir o salão na versão gorda  
- A/B que re-executa o dump FULL na API

## Próximo comando

S3: comprar **1.000 créditos** TESS, ligar `TESS_CONTEXT_MODE=scoped` só no ambiente de teste, gastar o pack em golden/smoke — **não** em atendimento ao salão.
