# Checklist: Auditoria Completa (SC_AGT_001)

```yaml
checklist:
  id: audit-checklist
  name: Auditoria Completa de Agente / Workflow / Sistema
  agent: pedro-valerio
  command: "*audit"
  version: "1.0.0"
  standard: SC_AGT_001
```

## Uso

Execute este checklist para qualquer artefato AIOX: agente, workflow, task, template ou processo.
Registre PASS / FAIL / N/A para cada item.

---

## Bloco A: Agente AIOX

### A1. Estrutura (Blocking)

- [ ] Total de linhas ≥ 300
- [ ] Level 0 (Loader) presente: ACTIVATION-NOTICE, IDE-FILE-RESOLUTION, REQUEST-RESOLUTION, command_loader, CRITICAL_LOADER_RULE, dependencies
- [ ] Level 1 (Identity) presente: agent metadata, persona completa, background
- [ ] Level 2 (Operational) presente: core_principles (5+), frameworks (1+), commands com visibility
- [ ] Level 3 (Voice DNA) presente: sentence_starters, vocabulary, metaphors, behavioral_states
- [ ] Level 4 (QA) presente: output_examples, anti_patterns, completion_criteria, objection_algorithms
- [ ] Level 6 (Integration) presente: workflow_integration, synergies, greeting

### A2. Qualidade de Conteúdo (Blocking)

- [ ] command_loader mapeia TODOS os comandos com arquivo externo
- [ ] CRITICAL_LOADER_RULE presente verbatim
- [ ] voice_dna.vocabulary.always_use ≥ 5 termos
- [ ] voice_dna.vocabulary.never_use ≥ 3 termos
- [ ] output_examples ≥ 3 com input real e output completo
- [ ] anti_patterns.never_do ≥ 5 itens
- [ ] behavioral_states ≥ 2 com trigger, output e signals
- [ ] objection_algorithms ≥ 3 com respostas completas
- [ ] completion_criteria.handoff_to ≥ 1

### A3. Qualidade Recomendada

- [ ] voice_dna.sentence_starters ≥ 5 patterns
- [ ] voice_dna.metaphors ≥ 3
- [ ] signature_phrases ≥ 5
- [ ] Total de linhas ≥ 800 (ideal)

---

## Bloco B: Workflow / Processo

### B1. Estrutura (Blocking)

- [ ] Trigger definido e verificável por sistema
- [ ] Saída/estado final definido
- [ ] Todas as etapas têm ação concreta (verbo + objeto)
- [ ] Nenhuma etapa com linguagem vaga ("se necessário", "conforme apropriado")

### B2. Controles (Blocking)

- [ ] Cada etapa tem checkpoint com condição booleana
- [ ] Cada checkpoint tem veto condition com ação de bloqueio
- [ ] Cada etapa tem owner identificado (não "time de X")
- [ ] SLA definido para handoffs críticos

### B3. Fluxo

- [ ] Fluxo é unidirecional OU retornos documentados com condições
- [ ] Não há etapa que pode ser silenciosamente pulada
- [ ] Edge cases documentados (dado faltando, owner ausente, trigger duplicado)

---

## Bloco C: Task AIOX

- [ ] Objetivo claro em 1-2 frases
- [ ] Entradas necessárias listadas
- [ ] Workflow de execução com fases
- [ ] Formato de saída definido
- [ ] Critério de conclusão verificável

---

## Bloco D: Template

- [ ] Todos os campos têm tipo definido (texto, número, data, seleção)
- [ ] Campos obrigatórios marcados
- [ ] Instruções de preenchimento por campo
- [ ] Exemplo preenchido completo
- [ ] Erros comuns documentados

---

## Formato de Relatório

```
## Auditoria: {nome do artefato}
**Tipo:** {Agente / Workflow / Task / Template}
**Data:** {data}
**Score:** {X}/{total} — {PASS / ATENÇÃO / FAIL}

### ❌ Blocking Issues ({count})
- [{bloco}.{item}] {descrição}
  → Correção: {ação específica}

### ⚠️ Non-blocking Issues ({count})
- [{bloco}.{item}] {descrição}

### ✅ Aprovado ({count} itens)

### Próxima Ação
{ação prioritária para resolver blocking issues}

---
<promise>COMPLETE</promise>
```

**Nota:** o sinal `<promise>COMPLETE</promise>` no final do relatório indica que a auditoria
foi executada até o fim (não ficou parcial). Convenção herdada de aios-core-main.

## Score Guide

| Score | Status | Significado |
|-------|--------|-------------|
| 10/10 | ✅ PASS | Pronto para produção |
| 8-9/10 | ⚠️ ATENÇÃO | Usável com ressalvas documentadas |
| < 8/10 | ❌ FAIL | Corrigir antes de usar |
