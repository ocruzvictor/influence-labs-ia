# Task: eng-map — Mapeamento de Processo

```yaml
task:
  id: eng-map
  name: Mapeamento de Processo
  agent: pedro-valerio
  command: "*eng-map {processo}"
  version: "1.0.0"
```

## Objetivo

Produzir mapa completo de processo com etapas, checkpoints, veto conditions e owners.
Resultado: executor sem contexto consegue seguir o processo sem ambiguidade.

## Entradas Necessárias

Antes de iniciar, colete:
1. **Nome do processo** — o que está sendo mapeado?
2. **Trigger** — o que inicia o processo?
3. **Saída esperada** — qual é o estado final correto?
4. **Participantes** — quem está envolvido?
5. **Ferramentas** — quais sistemas são usados?

Se alguma informação estiver faltando, pergunte antes de prosseguir.

## Workflow de Execução

### Fase 1: Levantamento de Etapas

Para cada etapa do processo:
- Descreva a **ação concreta** (verbo + objeto — ex: "Enviar e-mail de boas-vindas")
- Nunca use: "verificar se necessário", "conforme precisar", "quando relevante"
- Se a etapa tiver variações, divida em duas etapas separadas

### Fase 2: Definição de Checkpoints

Para cada etapa, defina:
- **Condição de continuidade:** o que deve ser verdadeiro para avançar?
- A condição deve ser verificável por sistema ou por pessoa com critério claro

### Fase 3: Veto Conditions

Para cada checkpoint:
- **O que bloqueia o avanço?** (condição false = bloquear)
- **Ação de bloqueio:** o que acontece quando é bloqueado?
- **Responsável pelo desbloqueio:** quem resolve?

### Fase 4: Owners

Para cada etapa:
- **Owner:** pessoa ou sistema responsável pela execução
- Nunca aceite "time de X" — identifique o cargo/papel específico
- Se for sistema automatizado, identifique qual sistema

### Fase 5: Validação de Unidirecionalidade

Verifique:
- [ ] O fluxo tem algum caminho de retorno?
- [ ] Se sim, o retorno está documentado com condições explícitas?
- [ ] Existe alguma etapa que pode ser pulada? Se sim, é intencional?

## Formato de Saída

```
## Processo: {nome}

**Trigger:** {o que inicia}
**Saída:** {estado final esperado}
**Sistemas:** {ferramentas envolvidas}

| # | Etapa | Checkpoint | Veto Condition | Ação de Bloqueio | Owner |
|---|-------|-----------|----------------|-----------------|-------|
| 1 | {ação} | {condição} | {condição de veto} | {o que acontece} | {nome/sistema} |

**Gaps identificados:**
- ⚠️ HIPÓTESE: {se houver suposições não confirmadas}

**Validação:**
- [ ] Todas as etapas têm ação concreta
- [ ] Todos os checkpoints têm condição booleana
- [ ] Todos os vetos têm ação de bloqueio definida
- [ ] Todos os owners são identificados (não "time de X")
- [ ] Fluxo é unidirecional ou retornos documentados
```

## Critério de Conclusão

DONE quando: alguém sem contexto algum consegue executar o processo corretamente seguindo apenas a tabela produzida.

Teste: leia a tabela como se fosse a primeira vez. Há alguma ambiguidade? Se sim, não está pronto.
