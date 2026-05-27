# QA Gate — PR #3: feat(conversa): refactor prompt agente Conversa v3.0.2

**Reviewer:** @qa (Quinn)
**Data:** 2026-05-26
**PR:** https://github.com/ocruzvictorpareto/influence-labs-ia/pull/3
**Branch:** `feature/conversa-v3-refactor` → `main`
**Tipo de mudança:** Artefatos (docs + prompts + KB + harness + story). Sem código de produção.
**Mergeable:** ✅ CLEAN (sem conflitos)

---

## Verdict

✅ **PASS** com 2 CONCERNS de baixa severidade (documentadas, não bloqueiam merge).

---

## Análise por dimensão

### 1. Integridade do PR vs commit
- ✅ 12 arquivos, +1867 / -0 linhas (matchs com escopo declarado da Frente A)
- ✅ Branch criada limpa a partir de `main` (não mistura com WIP do admin dashboard em `feature/1.1-admin-auth-scaffold`)
- ✅ Commit message conventional (`feat(conversa):`) + Co-Authored-By Claude

### 2. Segurança (secrets/credentials)
- ✅ Nenhum token TESS hardcoded — harness usa `process.env.TESS_API_TOKEN`
- ✅ Nenhuma senha/secret nas docs
- ✅ Telefones nos cenários de teste são fakes (`11999990000`, etc.) — whitelist real (Tiago `…0330` etc.) só aparece em docs internos, não em código executável
- ✅ `.aios/handoffs/` gitignored (runtime artifacts não vazaram)

### 3. Cross-references entre artefatos
- ✅ Prompt v3 referencia 6 arquivos de KB; todos os 6 existem em `data/kb/conversa-v2/`
- ✅ `sinonimos-servicos.md` (novo) está commitado e referenciado em `tess-conversa-v3.md` §C e `tess-conversa-v3-clean.md` §C
- ✅ Eval baseline (0.70) e eval final (1.00) ambos commitados, threshold (0.85) batido com margem
- ✅ Story A3 referencia `tess-conversa-v3.md` (consistente)

### 4. Story A3 — completude da spec
- ✅ Acceptance criteria com 8 critérios funcionais + 8 test cases unitários
- ✅ Implementação sugerida (código exemplo + estratégia tag-protection reversível)
- ✅ Risco/rollback documentado (revert do backend não invalida v3.0.2)
- ✅ Definition of Done explícito
- ⚠️ **CONCERN #1:** Story header menciona "v3.0.1" como prompt deployado (`Bloqueia: deploy do prompt v3.0.1`), mas a versão atual é v3.0.2. Cosmético — não muda comportamento técnico do splitter (regex e tags são as mesmas). Ajuste recomendado no início da story do @dev.

### 5. Harness — segurança e reprodutibilidade
- ✅ `scripts/test-conversa-v3.mjs` — sem credenciais hardcoded, lê de `backend/.env`
- ✅ 12 cenários explícitos (R1-R4 + NR2-NR4 + A1)
- ✅ Retry automático em respostas vazias (G7 do squad)
- ✅ Output JSON persistido em `scripts/test-conversa-v3-results.json` para histórico
- ✅ Reusável: pode rodar quantas vezes for preciso pós-mudanças no prompt

### 6. Risco de regressão funcional
- ✅ **Sem código de produção alterado** nesta PR — backend (`backend/server.js`) intacto
- ✅ Comportamento de booking/cancelamento/handoff preservado (NR1-NR4 todos PASS no eval)
- ✅ Rollback do prompt: usuário cola v2 de volta no painel TESS (mudança fora do repo)
- ⚠️ **CONCERN #2:** O prompt v3 depende do LLM honrar a instrução `<break>`. Eval rodou 2x com runs 11/12 e 12/12. Não-determinismo do LLM é conhecido. Em produção real, esporadicamente pode haver `<break>` ausente em resposta que deveria ter — não-crítico (cosmético), e A3 lida com tag-aware-ness independente disso.

### 7. Não-funcional (NFR)
- ✅ **Reproducibilidade:** harness determinístico para o critério (LLM não), output JSON salvo
- ✅ **Manutenibilidade:** estrutura de KB modular (6 arquivos focados), prompt modular (Crisp adaptado)
- ✅ **Auditabilidade:** changelog completo no header do prompt + eval reports com baseline ↔ final
- ✅ **Documentação:** 4 docs em `docs/qa/prompt-eval/` cobrem o caminho gate → baseline → eval final
- ⚠️ **Performance produção:** depende do throughput TESS + Kapso. Eval mede latência cumulativa indiretamente (timeout 120s em testes). Não testado em alta carga — fora do escopo desta PR.

---

## Concerns (não bloqueantes, registrados)

| # | Severidade | Item | Recomendação |
|---|------------|------|--------------|
| C1 | LOW | Story A3 header menciona "v3.0.1" (atual é v3.0.2) | @dev atualiza header ao iniciar implementação |
| C2 | LOW | Não-determinismo do LLM pode produzir respostas sem `<break>` esperado em produção real | Monitorar via supervisor matinal nas primeiras semanas pós-deploy; se taxa > 10%, abrir story de prompt-tightening |

---

## Pendências externas a esta PR

| # | Item | Status | Bloqueia |
|---|------|--------|----------|
| A3 | Splitter tag-aware no backend (`splitMessage()`) | Story aberta `docs/stories/salon-whatsapp-conversa-v3-splitter-backend.md` | Deploy em produção WhatsApp |
| A2 | Audit booking duration vs catálogo Trinks | Sem story formal ainda | Independente, não bloqueia v3 |

---

## Recomendação

✅ **APROVADO PARA MERGE.**

PR é puramente aditiva (12 novos arquivos, 0 deleções), sem mudança em código de produção, com:
- Eval empírico provando melhoria (v2 0.70 → v3.0.2 1.00)
- Trilha completa de auditoria (feedback → briefing → anatomia → prompt → gate → eval → story)
- Rollback trivial (mudança real está no painel TESS, fora do repo; reverter o PR não desliga o agente)
- Story A3 pronta para @dev pegar imediatamente após merge

Próximo passo após merge: @dev pega `salon-whatsapp-conversa-v3-splitter-backend.md` → smoke test WhatsApp com whitelist após A3 → expansão whitelist.

---

*QA Review por Quinn (Guardian) — `prompt-engineering-squad` Frente A. Gate decision baseada em integridade de artefatos, segurança, cross-references e eval empírico. CodeRabbit não rodado (PR sem código de produção; checklist tradicional N/A).*
