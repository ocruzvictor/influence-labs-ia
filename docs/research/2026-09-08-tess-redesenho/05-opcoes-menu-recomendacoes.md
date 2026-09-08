# Opções, trade-offs e menu de decisão

**Orquestra:** Orion  
**Status:** pesquisa concluída · **sem go-live** · aguardando ACK Victor  

---

## TL;DR executivo

1. **T1/T2 não falharam porque o 2-phase “não funciona”.** Matheus chegou ao 201. Falharam porque a **boca promete antes do eixo commit** e **não há lock de inventário** — F5 mudou adjetivo, não mecanismo.
2. **H3 parcial · H4 confirmada · H1/H7 depois.** Modelo é variável **terciária** até fluxo/lock endereçados.
3. **Mega-agente 46589** concentra risco (H6), mas o split real **já existe em código** (intent, guards, 2-phase). Squad só vale com **veto por agente**.
4. **Cowork/DE** serve **assíncrono** (auditor, fila Martelo) — **não** substitui WhatsApp 25s.
5. **OpenClaw** = camada Office (memória, heartbeat) — complementar, não hot-path.
6. **Hermes** = **duas hipóteses** (plugin runtime vs OSS model) — nenhuma é escolha desta sessão.

---

## Tabela de hipóteses — veredicto pesquisa

| ID | Hipótese | Veredicto | Confiança |
|---|---|---|---|
| H1 | Modelo Haiku sem thinking | **Inconclusivo** — sintoma menor vs 0 POST | Média |
| H2 | Prompt único ~31k tok | **Confirmado** como custo; **não** causa raiz I1 | Alta |
| H3 | 2-phase/hold/tags/F3 = bug | **Parcial** — 2-phase OK; hold/F3/F5 **sim** | Alta |
| H4 | Falta lock inventário | **Confirmado** | Alta |
| H5 | Intent + info-open frágil | **Confirmado** | Média |
| H6 | Um agente FAQ+BOOKING | **Confirmado** como risco escopo | Alta |
| H7 | OSS / effort | **Prematuro** | Média |
| H8 | DE/Cowork substituto | **Refutado** hot-path; **válido** async | Alta |
| H9 | Human AI Martelo | **Confirmado** necessário para F3×F5 | Alta |
| H10 | Squad > mega-agente | **Condicional** — só com veto+I1 multi-path | Média |
| H11 | Hermes acurácia/custo | **Dupla** — plugin=rewrite; OSS=A/B | Baixa |
| H12 | OpenClaw fecha gap | **Parcial** — Office, não booking sync | Média |

---

## Opções de redesign (pick one para próxima story)

### Opção 1 — **Lock-first** (recomendada pesquisa)

**O quê:** estado PROPOSED → HELD (TTL) → COMMITTING → CONFIRMED no Express; copy condicional; ampliar sanitize F5.

| Prós | Contras |
|---|---|
| Menor blast radius | Schema hold + regras copy |
| Reusa Stories 1–13 | F3×F5 parcial sem Martelo |
| Ataca race 13h | Exige testes smoke 0007 |

**Effort:** M · **Risco I1:** ↓↓ · **Crédito:** ~flat  

---

### Opção 2 — **Lock-first + Martelo recepção**

**O quê:** Opção 1 + handoff com aceite nomeado + SLA; recepção assina/nega POST.

| Prós | Contras |
|---|---|
| Fecha Denise / F3×F5 | Fricção operacional |
| Syncra-aligned | UI mínima necessária |
| Accountability claro | Treinamento salão |

**Effort:** M–L · **Risco I1:** ↓↓↓ · **Crédito:** ~flat  

---

### Opção 3 — **Squad FAQ/BOOKING/HANDOFF**

**O quê:** 3 agentes Tess; só BOOKING emite tags; FAQ denylist verbos commit.

| Prós | Contras |
|---|---|
| ↓ prefixo BOOKING | 3× superfície I1 |
| Isola PIX/combo | Config Tess complexa |
| Alinha H6 | Re-teste total invariantes |

**Effort:** L · **Risco I1:** ↑ sem veto · **Crédito:** ↓ FAQ  

**Pré-requisito:** Opção 1 hold compartilhado + auditoria OP006.

---

### Opção 4 — **DE Cowork auditor assíncrono**

**O quê:** 46589 permanece; DE pós-turno detecta drift copy vs ledger; alerta Nightwatch.

| Prós | Contras |
|---|---|
| Não mexe hot-path | Não previne walk-in |
| Mission Control visibility | Bridge a construir |
| Rollback DE templates | +runs crédito |

**Effort:** M · **Risco I1:** detecta, não previne · **Crédito:** +  

**Combinável** com Opção 1 ou 2.

---

### Opção 5 — **Hermes gateway (greenfield)**

**O quê:** Kapso → Hermes plugin → reimplementar guards/2-phase/snapshot.

| Prós | Contras |
|---|---|
| OSS control | Big-bang |
| Kapso nativo | Perde 13 stories |
| Cron Hermes | Timeline longa |

**Effort:** XL · **Risco I1:** desconhecido · **Veredicto:** **PARK** até Opção 1–2 provadas.

---

### Opção 6 — **Model-first A/B**

**O quê:** Sonnet effort=low ou Haiku+thinking budget vs baseline.

| Prós | Contras |
|---|---|
| Rápido no painel | Não fixa 0 POST |
| Dados comparativos | ↑ cr; trava 01/set |
| | Falso positivo se H4 aberto |

**Effort:** S · **Veredicto:** **somente após** Opção 1 smoke.

---

## O que reusar (consolidado)

- Invariantes I1–I3 e 2-phase
- Classificador intent regex + assembler + guards
- Snapshot worker + Nightwatch MCP
- Blueprint Pedro 03/09 (delta, não redo)
- Lib Forge OP001–007 como diagnóstico
- Supervisor 46590 pattern (async digest)
- Kit squads Pedro/Forge/DR (ON_DEMAND)

## O que derrubar (consolidado)

- Patch só copy F5 sem lock
- “Trocar LLM” como primeira alavanca
- Cowork/DE substituindo 46589 síncrono
- OpenClaw no hot-path 25s
- Hermes day-one replace
- Forge generate nesta sessão
- OPEN / startPilot / colar 46589
- `@dr-orchestrator` full pipeline — **não acionado**; escopo coberto por tech-search + personas

---

## Falhas e brechas (checklist)

| Brecha | Evidência | Opção que fecha |
|---|---|---|
| Boca ≠ POST | T1 9343 · T2 1734/6960 | 1, 2 |
| Race 13h | 1734/7335/4307 | 1 |
| F3×F5 | recepção mata 2-phase | 2 |
| F5 hold semantics | 0 POST pós-copy | 1 |
| PIX/combo no booking | 8194/0745 | 3 |
| Mute FAQ | 6189/9536 | 3 ou intent fix |
| Handoff sem dono | G-P5 | 2 |
| Observabilidade drift | confirmacao=0 PILOT | 4 + OP006 |

---

## Menu Victor (escolher número)

| # | Ação | Owner sugerido |
|---|---|---|
| **1** | ACK **Opção 1** → story SM + arquitetura hold TTL | @sm → @architect |
| **2** | ACK **Opção 2** (1+Martelo) → story + UX recepção | @sm → @ux-design-expert |
| **3** | ACK **Opção 3** squad → story + veto spec | @sm → @architect |
| **4** | ACK **Opção 4** DE auditor → spike Cowork API | @architect → @dev |
| **5** | Pedir relatório longo FDS §§6,7,9 | @analyst |
| **6** | Pedir blueprint Pedro completo re-leitura | @pedro-valerio |
| **7** | PARK Hermes/OpenClaw greenfield | — |
| **8** | Disparar `@dr-orchestrator` pipeline formal 11 agentes | @dr-orchestrator |
| **0** | Só arquivar pesquisa — sem próxima story | — |

---

## Travas (continuam)

Sem OPEN · sem POST teste · sem Hostinger · sem colar 46589 · sem generate Forge · last4 only · Haiku+Thinking só A/B pesquisado · mode=OFF até ACK.

---

*Orion · menu de decisão · pesquisa redesenho Tess · 2026-09-08*
