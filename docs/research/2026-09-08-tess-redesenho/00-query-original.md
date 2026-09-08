# Query original — redesenho Tess (pós T1+T2)

**Data:** 2026-09-08  
**Modo:** pesquisa · sessão limpa · sem implementar · sem OPEN  
**Orquestra:** Orion → Pedro · Forge · Analyst · Architect  

## Pergunta central

Como redesenhar o atendimento do salão (WhatsApp → Tess → Trinks) do início ao fim para ser **mais acurado e mais eficiente**, sabendo que T1 e T2 falharam no **mesmo ponto**: a boca promete compromisso; o sistema não locka inventário e muitas vezes não muta a agenda?

## Norte medido (não reprocessar FDS)

| Onda | Sintoma | Dano |
|---|---|---|
| T1 | “Confirmo” + endereço | 0 POST Trinks |
| T2 | F5 “Já estou confirmando na agenda” | 0 POST · walk-in |
| T1+T2 | Oferta verbal = slot | race 13h · relógio sujo |

**confirmacao = 0** nas duas ondas. Patches mudaram copy, não o dano.

## Eixos ampliados (ordem de investigação)

1. **Fluxograma + lock (H3/H4)** — 2-phase/hold/tags/F3 é o bug?
2. **Squads** vs mega-agente 46589
3. **Digital Employee + Cowork** Tess (Mission Control ≠ WhatsApp 46589)
4. **Human AI / Syncra** — IA executa, humano assina (Martelo); F3×F5
5. **Modelos** — Haiku 4.5 sem Thinking vs effort/reasoning vs OSS; Hermes (modelo **e** plugin) como hipótese
6. **OpenClaw / Mission Control / Synkra Factory / Tess Cowork** — o que serve ao salão sem inventar produto

## Restrições

- Ler só `MEMORY` + handoff (+ blueprint/Forge **sob demanda** via referência, não corpus FDS)
- Saída em `docs/research/2026-09-08-tess-redesenho/`
- Sem go-live · sem Hostinger · sem POST Trinks · sem colar 46589 · sem generate Forge
- MCP pesquisa: WebSearch (EXA_API_KEY ausente); `tess` + MCP_DOCKER intactos

## Fontes primárias desta sessão

| Fonte | Uso |
|---|---|
| `docs/ops/MEMORY-tess-t1-t2-fds-2026-09-08.md` | Hipóteses H1–H12, números T1/T2 |
| `docs/handoffs/2026-09-08-orion-handoff-redesenho-pesquisa.md` | Orquestra e travas |
| `docs/analysis/2026-09-03-pedro-valerio-blueprint-tess.md` | Delta fluxo (§§2–4, invariantes I1–I3) |
| `docs/analysis/2026-09-03-lib-forge-oportunidades-tess.md` | OP001–018 analysis-only |
| `docs/guides/tess-api-reference.md` § Digital Employees | Cowork API |
| `docs/research/influence-labs-foundation-report.md` §§1.1, Tipo 5–6 | OpenClaw vs Factory |
| Web: Tess Cowork, OpenClaw docs, Kapso Hermes plugin, HLD Saga/lock | Hipóteses externas |
