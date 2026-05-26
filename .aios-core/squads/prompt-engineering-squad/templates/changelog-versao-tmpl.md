# Changelog de Versão de Prompt — Template

**Versão do template:** `v0.1.0`
**Owner do preenchimento:** Aprovador Humano (etapa 9 — registra motivo) + `prompt-release-manager` (etapa 10 — registra deploy)
**Fecha gap:** G5 (reports de eval não declaram motivo) + G3 (versionamento manual)

> Um arquivo de changelog por `id_prompt`, cronológico decrescente (versão mais recente no topo).
> Caminho sugerido: `docs/knowledge-base/changelogs/{{ID_PROMPT}}-changelog.md` (o squad não impõe path; o release-manager registra na fonte de verdade do destino).
>
> **Regra dura:** sem `motivo_declarado` preenchido, etapa 9 bloqueia. Sem `commit_hash` e `cópias_reconciliadas`, etapa 10 bloqueia.

---

## Entrada de versão (copiar bloco abaixo para cada release)

```yaml
- versao: "{{vMAJOR.MINOR.PATCH}}"             # ex: v2.1.0
  data: "{{YYYY-MM-DD}}"
  aprovador: "{{NOME_DO_APROVADOR_HUMANO}}"    # gate humano etapa 9 — indelegável

  motivo_declarado: |
    {{TEXTO_LIVRE_OBRIGATORIO}}
    # Por que esta versão existe. O que está sendo resolvido ou melhorado.
    # Frase de negócio + frase técnica. Sem "melhoria geral", sem "ajustes".
    # Exemplo válido:
    #   "Lead Alhurez estava recebendo catálogo B2C por chat antes do handoff
    #   (eval-run 2026-05-21, cenário 6, FAIL). Add instrução imperativa
    #   'sem catálogo no chat para perfil Alhurez' + few-shot dedicado."

  mudancas:
    # Lista de bullets — o que mudou OBJETIVAMENTE no prompt (não o motivo).
    - "{{MUDANCA_1}}"   # ex: "Adicionada seção 'PERFIL ALHUREZ — REGRA' na anatomia R"
    - "{{MUDANCA_2}}"   # ex: "Few-shot 7 adicionado (lead Alhurez → handoff sem catálogo)"
    - "{{MUDANCA_N}}"

  gaps_enderecados:
    # IDs de gap do insumo OU IDs internos do registro do squad.
    - "{{GAP_ID}}"      # ex: G14, G16, ou EVAL-FP-001

  caso_validacao:
    # Qual eval/cenário comprova que a mudança funciona.
    eval_run: "{{PATH_OU_ID_DO_RUN}}"   # ex: docs/qa/eval-runs/2026-05-23-alhurez-fix/RELATORIO.md
    cenarios: ["{{ID_OU_NOME_CENARIO}}"]  # ex: [6, "Lead Alhurez — premium exclusivo"]
    verdict_pre: "{{VERDICT_ANTES}}"    # ex: FAIL
    verdict_pos: "{{VERDICT_DEPOIS}}"   # ex: PASS

  copias_reconciliadas:
    # TODA cópia que carrega o prompt em qualquer formato.
    # Sem reconciliação completa → veto na etapa 10 (G1, G2).
    - "{{PATH_OU_DESTINO_1}}"   # ex: docs/knowledge-base/sdr-prompt-v2-tess-ready.md
    - "{{PATH_OU_DESTINO_2}}"   # ex: playground/api/src/lib/sdr-prompt-text.ts (constante SDR_PROMPT_APPROVED)
    - "{{PATH_OU_DESTINO_3}}"   # ex: TESS Studio — agent_id 44853 (system prompt)
    - "{{PATH_OU_DESTINO_N}}"

  commit_hash: "{{SHA}}"                # preenchido pelo Release Manager após git commit
  deploy_timestamp: "{{ISO_8601}}"      # quando o deploy no destino terminou
```

---

## Exemplo preenchido (referência)

```yaml
- versao: "v2.1.0"
  data: "2026-05-22"
  aprovador: "Victor Cruz"

  motivo_declarado: |
    Revisão de 2026-05-22: adicionar ancoragem com valores em R$ (Treinamento 2
    §199-219), coleta de email antes de proposta/handoff (POP 3 cadastro CRM),
    noção de tempo (assumir próxima ocorrência futura), e banir "galera"
    (público acima de 35 anos).

  mudancas:
    - "Add bloco ANCORAGEM no Context com valores R$ por linha (Essencial/Definitiva/Privativo/Alhurez)"
    - "Add regra COLETA-EMAIL antes de qualquer handoff (POP 3)"
    - "Add regra TEMPO no Context: 'assumir próxima ocorrência futura quando lead diz apenas mês'"
    - "Add 'galera' à lista forbidden_vocab no checklist da etapa 5"

  gaps_enderecados:
    - "G14"   # localização declarada das fontes (Treinamento 2 §199-219, POP 3)
    - "EVAL-FP-002"  # exceção 'galera' adicionada ao evaluator escopo SDR

  caso_validacao:
    eval_run: "docs/qa/eval-runs/2026-05-22-rev-ancoragem/RELATORIO.md"
    cenarios: [2, 6]
    verdict_pre: "NEEDS_ADJUSTMENT"
    verdict_pos: "PASS"

  copias_reconciliadas:
    - "docs/knowledge-base/sdr-prompt-v2-tess-ready.md"
    - "TESS Studio — agent_id 44853 (system prompt — colado 2026-05-22 14:30 BRT)"

  commit_hash: "be4c409"
  deploy_timestamp: "2026-05-22T14:33:00-03:00"
```

---

*Template scaffold da FASE 3 — `prompt-engineering-squad` v0.1.0. Schema obrigatório; campos ausentes bloqueiam etapas 9/10.*
