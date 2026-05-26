# Handoff — Frente A: Refinamento UX do Agente Conversa

**Data:** 2026-05-26
**Status:** Ready to start
**Owner inicial:** @analyst → prompt-engineering-squad (briefer + writer + evaluator)

## Contexto

Studio Tirra (salão de Tiago Rocha em São Caetano do Sul/SP) está rodando o agente Conversa (TESS 46589) em produção. A waitlist (clientes reais) começou a interagir e Tiago + Gabriel (supervisor humano) estão coletando observações sobre a experiência real.

O agente está **funcional** (booking, cancelamento, transcrição áudio, after-hours, supervisor matinal todos funcionando), mas tem espaço pra refinamento de **comunicação**, **tom**, **forma de quebrar mensagens**, e **pequenas correções de fluxo conversacional** baseadas em feedback humano que não é capturável só por logs.

Objetivo da frente: levar o agente de "funciona" pra "soa natural e elegante".

## Goal

Prompt v3 do agente Conversa (46589) com ajustes finos derivados de feedback estruturado de Tiago + Gabriel, validados via bateria de testes antes de deploy.

## Não é o escopo desta frente

- Mudança de arquitetura do agente (continua sendo TESS 46589 + KB conversa-v2 + tags inline)
- Adição de novos recursos funcionais (booking 3-fase, IA visual, etc.) — fica pra epics separadas
- Painel admin (frente B paralela)

## Workflow sugerido

### Fase 1 — Intake estruturado (@analyst Alex)

1. Victor coleta os feedbacks brutos (texto livre) que Tiago e Gabriel enviaram
2. @analyst executa `*brainstorm` pra estruturar:
   - Quais padrões aparecem repetidamente?
   - Quais são one-off vs sistêmicos?
   - Que tipo de problema? (tom, quebra, contexto, latência, factual, etc.)
   - Severidade subjetiva por categoria
3. Output: documento `docs/feedback/2026-05-XX-waitlist-feedback-structured.md` com categorização

### Fase 2 — Brief do refactor (@prompt-briefer)

1. Carrega o documento estruturado da Fase 1
2. Define escopo da iteração: quais categorias vão entrar, em que ordem
3. Documenta restrições conhecidas (TESS tem temperatura 0.4, tem que manter v2 inline tags, etc.)
4. Output: briefing v2 do prompt em `docs/prompts/briefings/conversa-v3-brief.md`

### Fase 3 — Reescrita (@prompt-writer)

1. Aplica os ajustes do briefing no prompt v2
2. Mantém estrutura PACER/Crisp existente
3. Output: `docs/prompts/tess-conversa-v3.md`

### Fase 4 — Avaliação (@prompt-evaluator)

1. Roda bateria de testes (estende `scripts/test-conversa-v2.mjs` ou cria `v3.mjs`)
2. Compara saídas v2 vs v3 nos mesmos prompts de teste
3. Verdict: APROVADO | REVISAR | REJEITAR
4. Output: `scripts/test-conversa-v3-results.json` + relatório

### Fase 5 — Deploy

1. Victor cola v3 no painel TESS agente 46589
2. Smoke test em prod com whitelist (3 telefones)
3. Acompanha por 2-3 dias com supervisor matinal capturando regressões
4. Documenta o que mudou em `docs/deploy/2026-XX-XX-conversa-v3.md`

## Inputs esperados de Victor

Antes de chamar @analyst, ter à mão:

- [ ] Logs/screenshots/textos dos feedbacks de Tiago e Gabriel (qualquer formato)
- [ ] Lista de números na waitlist (pra @analyst correlacionar com `conversation_history`)
- [ ] Decisão: rodar V3 com whitelist atual (3 números) ou expandir antes do refactor
- [ ] Janela de tolerância pra A/B test (ex: 1 semana com V2 e V3 alternados? Ou direto V3?)

## Arquivos relevantes

- `docs/prompts/tess-conversa-v2.md` — prompt atual (v2)
- `data/kb/conversa-v2/*.md` — KB que o LLM consulta
- `scripts/test-conversa-v2.mjs` + `scripts/test-conversa-v2-robust.mjs` — bateria atual
- `backend/server.js:processMessage` — pipeline que injeta contexto dinâmico

## Comando pra começar

```
@analyst
*brainstorm sobre os feedbacks de waitlist Studio Tirra (Tiago + Gabriel)
```

Ou direto:
```
@aios-master *task brainstorm
```

E carrega os feedbacks brutos como input.

## Recursos no projeto

- `.aios-core/squads/prompt-engineering-squad/` — agentes briefer/writer/evaluator/methodology-curator/release-manager
- `.aios-core/squads/prompt-engineering-squad/data/biblioteca-anatomias.md` — anatomias de prompt
- `.aios-core/squads/prompt-engineering-squad/workflows/prompt-engineering-pipeline.yaml` — workflow estruturado
