# Task: tmpl-instructions — Instruções de Preenchimento

```yaml
task:
  id: tmpl-instructions
  name: Geração de Instruções de Preenchimento
  agent: pedro-valerio
  command: "*tmpl-instructions {processo}"
  version: "1.0.0"
```

## Objetivo

Gerar guia passo-a-passo para execução de um processo, com exemplos e erros comuns.
Resultado: executor consegue concluir o processo sem suporte externo.

## Entradas Necessárias

1. **Processo ou template** que precisa de instruções
2. **Público-alvo** das instruções (novato / intermediário / sistema automatizado)
3. **Erros conhecidos** que ocorrem na execução (se houver histórico)

## Workflow de Execução

### Fase 1: Identificar Passos Executáveis

Para o processo/template, liste passos:
- Cada passo é uma ação concreta
- Verbo + objeto explícito ("Abrir arquivo X", não "preparar")
- Sequencial e unidirecional

### Fase 2: Por Passo, Documente

| Componente | Descrição |
|-----------|-----------|
| **O QUE fazer** | Ação concreta |
| **POR QUE** | Razão sistêmica (não "porque sim") |
| **COMO** | Procedimento ou comando exato |
| **VERIFICAR** | Como confirmar que deu certo |
| **SE FALHAR** | O que fazer em caso de erro |

### Fase 3: Exemplos Concretos

Por passo (ou por bloco de passos), inclua exemplo realista:
- Input real (anonimizado se necessário)
- Output esperado
- Erro comum + como identificar + correção

### Fase 4: Erros Comuns (FAQ)

Liste:
- Erros já vistos na prática (se há histórico)
- Erros prováveis (baseado na complexidade do passo)
- Por cada erro: sintoma + causa raiz + correção

### Fase 5: Calibrar para o Público

**Para novato:** mais contexto, screenshots, "por que" explicado em detalhe
**Para intermediário:** focar nos pontos não-óbvios e armadilhas
**Para sistema automatizado:** instruções machine-readable (JSON/YAML)

## Formato de Saída

```
# Instruções: {Processo}

**Público-alvo:** {Novato / Intermediário / Sistema}
**Tempo estimado:** {min-max minutos}
**Pré-requisitos:** {lista — acessos, dados, ferramentas}

---

## Passo 1: {Nome do Passo}

**O QUE:** {ação concreta}
**POR QUE:** {razão sistêmica}
**COMO:**
1. {sub-ação 1}
2. {sub-ação 2}

**VERIFICAR:** {critério de sucesso verificável}

**SE FALHAR:**
- Sintoma: {o que você vai observar}
- Causa provável: {por que ocorre}
- Correção: {passo específico para resolver}

**Exemplo:**
- Input: `{exemplo real}`
- Output esperado: `{exemplo real}`

---

## Passo 2: ...

---

## FAQ — Erros Comuns

### Erro: {nome curto do erro}
**Sintoma:** {o que aparece}
**Causa:** {razão}
**Correção:** {passos para resolver}

### Erro: ...

---

## Checklist Final
- [ ] Passo 1 concluído (verificação X passou)
- [ ] Passo 2 concluído (verificação Y passou)
- [ ] Output final validado
```

## Critério de Conclusão

DONE quando: cada passo tem O QUE + POR QUE + COMO + VERIFICAR + SE FALHAR, exemplos concretos, FAQ com 3+ erros comuns, checklist final verificável.

Teste: alguém do público-alvo lê e executa sem perguntas? Se gerar perguntas, há gap.
