# Eval Baseline — Conversa v2 (medindo antes do deploy v3)

**Evaluator:** @prompt-evaluator
**Data:** 2026-05-26
**Harness:** scripts/test-conversa-v3.mjs (criado nesta sessão)
**Resultado JSON:** scripts/test-conversa-v3-results.json
**Score:** 7/10 = 0.70 (THRESHOLD_EVAL = 0.85 → abaixo)

## Hipótese de execução

O eval rodou contra a API TESS do agente 46589, que **provavelmente ainda está com o prompt v2** colado no painel.
Evidências:
- Zero ocorrências de `<break>` em 10 outputs (v3 deveria gerar em vários)
- `**bold**` decorativo presente em outputs (v2 removeu, v3 mantém removido)
- Comparativo de preço não-solicitado em R2.1 e R1.2 (v3 bloqueia)

## Falhas observadas (todas REAIS do prompt v2, NÃO do harness)

### R1.2 — "tem profissional mais em conta?"
- **Resposta:** "Ótimo! O Erick sai mais em conta: R$ 70 no Corte Masculino."
- **Violação:** diferenciou por preço ("mais em conta", "sai mais em conta")
- **No v3.0.1:** R3 explicitamente proíbe diferenciação por preço; bloco S manda usar qualidade/especialidade.

### R2.1 — "quanto custa um corte?"
- **Resposta:** "O Corte Masculino custa entre R$ 70 e R$ 100, dependendo do profissional. O Erick faz por R$ 70, e o Tiago e o André cobram R$ 100."
- **Violação:** listou comparativo profissional×preço sem solicitação (R2)
- **No v3.0.1:** P (NUNCA) proíbe listar valores em formato comparativo sem solicitação explícita.

### R4.1 — "queria cortar sábado"
- **Resposta:** "Oi João! Show, corte no sábado (30 de maio) — temos sim! \n\nQual você prefere: **Tiago**, **André** ou **Erick**?..."
- **Violação:** resposta com 2+ ideias, mas zero `<break>` (e ainda usa `**bold**`)
- **No v3.0.1:** I.10 manda inserir `<break>` em pontos de quebra natural; S proíbe `**bold**` decorativo (herdado do v2).

## Casos que passam (mesmo no v2)

7 casos passaram porque os critérios são tolerantes a comportamento v2 OU porque o cenário não exercita a regra nova:
- R1.1 (não cita outros profs sem solicitação — v2 já não fazia isso espontaneamente)
- R3.1 (cita qualidade/especialidade — v2 KB já tinha isso)
- R4.2 (confirmação em bloco único — v2 padrão)
- NR2.1, NR3.1, NR4.1, R4.3

## Próximo passo (obrigatório antes de qualquer correção)

1. Victor cola o bloco do v3.0.1 (`## REGRA ZERO — DADOS` até `# FIM DO PROMPT`) no painel TESS 46589
2. Confirma config: Sistemático + criatividade Baixa
3. Re-roda `node scripts/test-conversa-v3.mjs`
4. Esperado: score → ≥0.85 nos mesmos cenários
5. Se ainda <0.85 com v3 deployado: aí sim @prompt-evaluator *diagnosticar-falhas → classifica FP vs violação real → loop normal

## Decisão

Eval round 1 = **BASELINE V2 documentado**. Não disparo Etapa 7 (diagnóstico) porque a falha não é do v3 — é do v2 que ainda está no ar. Diagnosticar como violação real causaria correção em prompt que já tem as regras escritas (ruído).
