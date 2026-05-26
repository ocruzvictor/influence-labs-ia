# Task: eng-owners — Definição de Ownership (RACI)

```yaml
task:
  id: eng-owners
  name: Definição de Ownership
  agent: pedro-valerio
  command: "*eng-owners {processo}"
  version: "1.0.0"
```

## Objetivo

Atribuir responsabilidade clara por etapa de processo usando matriz RACI.
Resultado: nenhuma etapa fica sem dono nomeado, nenhum dono fica sem etapa.

## Entradas Necessárias

1. **Processo mapeado** — saída de `*eng-map` ou lista de etapas equivalente
2. **Lista de papéis/cargos** envolvidos (não nomes pessoais — papéis)
3. **Sistemas automatizados** que executam etapas (se houver)

Se o processo não está mapeado, execute `*eng-map` primeiro.

## Workflow de Execução

### Fase 1: Identificar Papéis

Liste todos os papéis envolvidos. Use cargo/função, não nome de pessoa:
- "SDR Bot" não "João do comercial"
- "Customer Success Lead" não "Maria"
- "N8N Workflow X" não "automação"

### Fase 2: Aplicar Matriz RACI

Para cada etapa, atribua **exatamente um** R e **exatamente um** A.

| Letra | Significado | Regra |
|-------|-------------|-------|
| **R** — Responsável | Executa a etapa | UM por etapa (sem rateio) |
| **A** — Accountable | Responde pelo resultado | UM por etapa (pode ser igual ao R) |
| **C** — Consultado | Opina antes da decisão | Zero ou mais |
| **I** — Informado | Recebe notificação após | Zero ou mais |

### Fase 3: Validar Sem Lacunas

Verifique:
- [ ] Toda etapa tem R nomeado?
- [ ] Toda etapa tem A nomeado?
- [ ] Existe papel sem nenhuma atribuição? (papel inútil — remover ou justificar)
- [ ] Existe papel com R em todas as etapas? (gargalo — redistribuir)

### Fase 4: Definir Backup

Para cada papel R:
- Quem substitui em caso de ausência?
- Qual o SLA para backup assumir?

## Formato de Saída

```
## Ownership: {processo}

### Matriz RACI

| # | Etapa | R (executa) | A (responde) | C (consultado) | I (informado) | Backup do R |
|---|-------|------------|--------------|---------------|--------------|-------------|
| 1 | {ação} | {papel} | {papel} | {papel} | {papel} | {papel + SLA} |

### Distribuição de Carga
| Papel | # Etapas como R | # Etapas como A |
|-------|----------------|-----------------|
| {papel} | {n} | {n} |

### Gaps Identificados
- ⚠️ {se algum papel está sobrecarregado ou subutilizado}

### Validação
- [ ] Toda etapa com R único
- [ ] Toda etapa com A único
- [ ] Todo papel tem ao menos uma atribuição
- [ ] Nenhum papel é R em > 60% das etapas (sem justificativa)
- [ ] Todo R tem backup com SLA
```

## Critério de Conclusão

DONE quando: matriz RACI completa, distribuição de carga calculada, gaps sinalizados, backups com SLA definidos.

Teste: peça para uma pessoa fora do contexto identificar quem chamar para cada etapa. A resposta deve ser inequívoca.
