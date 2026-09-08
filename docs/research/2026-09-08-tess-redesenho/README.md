# Pesquisa — redesenho Tess (pós T1+T2)

**Status:** ✅ pesquisa entregue · **sem go-live** · aguardando ACK  
**Data:** 2026-09-08  
**Orquestra:** Orion → Pedro · Architect · Analyst · Lib Forge  

---

## TL;DR

A boca promete; o sistema não locka e muitas vezes não muta. **Não é bug do 2-phase** — é ausência de **lock pré-fala** + conflito **F3×F5** + mega-agente sem veto no entorno do commit. **Modelo vem depois.**

O menu isolado (arquivo 05) **não** cobre o objetivo ponta a ponta. A decisão agora é o **pipeline** no [06](./06-pipeline-decisao.md): spec Onda 1 (lock + Martelo) → stories gated → squad/DE/modelo só com I1 no ar.

---

## Índice de entregas

| Arquivo | Conteúdo | Persona |
|---|---|---|
| [00-query-original.md](./00-query-original.md) | Pergunta, eixos, restrições | Orion |
| [01-pedro-delta-fluxo-lock.md](./01-pedro-delta-fluxo-lock.md) | eng-map · eng-gaps · veto-check delta T1/T2 | @pedro-valerio |
| [02-architect-fluxograma-alvo.md](./02-architect-fluxograma-alvo.md) | AS-IS vs TO-BE (A–D) | @architect |
| [03-eixos-pesquisa-web.md](./03-eixos-pesquisa-web.md) | DE/Cowork · OpenClaw · Hermes · modelos · squads | @analyst |
| [04-lib-forge-oportunidades-resumo.md](./04-lib-forge-oportunidades-resumo.md) | OP001–018 analysis-only | @lib-forge |
| [05-opcoes-menu-recomendacoes.md](./05-opcoes-menu-recomendacoes.md) | Menu de opções isoladas (recorte pesquisa) | Orion |
| [06-pipeline-decisao.md](./06-pipeline-decisao.md) | Pipeline · ACK **A** feito | Orion |
| [onda-1-spec/](./onda-1-spec/spec.md) | Spec Onda 1 + critique **APPROVED** | architect · Pedro · Dara · Uma · Quinn |
| Story 1 Draft | [salon-whatsapp-tess-redesenho-1-hold-sanitize-f5.md](../../stories/salon-whatsapp-tess-redesenho-1-hold-sanitize-f5.md) | @sm |

---

## Entrada (não duplicar)

- Memória: `docs/ops/MEMORY-tess-t1-t2-fds-2026-09-08.md`
- Handoff: `docs/handoffs/2026-09-08-orion-handoff-redesenho-pesquisa.md`
- Blueprint delta: `docs/analysis/2026-09-03-pedro-valerio-blueprint-tess.md`
- Relatório FDS (sob demanda): `docs/analysis/2026-09-08-relatorio-teste-fds.md`

---

## Ordem de leitura sugerida

1. **05** menu (decisão)  
2. **01** Pedro (por que copy não bastou)  
3. **02** Architect (opções A–D)  
4. **03** web (DE, OpenClaw, Hermes, modelos)  
5. **04** Forge (diagnóstico 0 LLM)  

---

## Próximo passo

Escolher item do **menu §05** (1–8 ou 0). Ninguém implementa até ACK.

---

*Orion · docs/research/2026-09-08-tess-redesenho · 2026-09-08*
