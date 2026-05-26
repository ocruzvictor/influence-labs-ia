# Task: arq-statuses — State Machine

```yaml
task:
  id: arq-statuses
  name: Definição de State Machine
  agent: pedro-valerio
  command: "*arq-statuses {workflow}"
  version: "1.0.0"
```

## Objetivo

Definir máquina de estados finita para entidade/workflow com transições, condições e ações.
Resultado: nenhum estado válido fica sem entrada e sem saída documentadas.

## Entradas Necessárias

1. **Entidade ou workflow** que terá state machine
2. **Estados possíveis** (saída da fase 2 de `*arq-structure` se já feita)
3. **Eventos** que disparam transições

## Workflow de Execução

### Fase 1: Listar Estados

Verificar:
- [ ] Estados são mutuamente exclusivos? (entidade só pode estar em UM estado por vez)
- [ ] Existe estado inicial? (todo objeto começa em algum lugar)
- [ ] Existem estados terminais? (estados sem saída — fim do ciclo)
- [ ] Cada estado tem definição clara do que significa?

### Fase 2: Mapear Transições

Para cada transição, defina:
- **Estado origem** → **Estado destino**
- **Evento gatilho:** o que dispara a transição?
- **Condição de guarda:** o que deve ser verdadeiro para permitir a transição?
- **Ação:** o que acontece durante/após a transição?

### Fase 3: Validar Cobertura

| Verificação | Como testar |
|-------------|-------------|
| Todo estado tem entrada? | Existe transição que termina nele (exceto inicial) |
| Todo estado tem saída? | Existe transição que sai dele (exceto terminais) |
| Estados não-terminais com saída única? | Se sim, justificar — pode ser etapa redundante |
| Loops são intencionais? | Documentar condição de saída do loop |

### Fase 4: Definir Veto Conditions

Para cada transição, o que a BLOQUEIA?
- Dados obrigatórios faltando
- Permissão insuficiente do executor
- Estado externo incompatível
- Janela temporal incorreta

### Fase 5: Documentar Eventos Inválidos

Para cada par (estado, evento) inválido:
- Comportamento: ignorar silenciosamente / erro explícito / log de tentativa
- **Recomendação:** sempre log + erro explícito (silencioso esconde bugs)

## Formato de Saída

```
## State Machine: {entidade}

**Estado Inicial:** {estado}
**Estados Terminais:** {lista}

### Diagrama de Transições
| # | Origem | Destino | Evento | Guarda | Ação | Veto |
|---|--------|---------|--------|--------|------|------|
| 1 | new | qualifying | qualification_started | tem_telefone | set_started_at=now | BLOCK se opt_out |
| 2 | qualifying | qualified | bant_score >= 60 | bant_complete | tag='hot_lead' | - |
| 3 | qualifying | disqualified | bant_score < 60 | bant_complete | tag='nurture' | - |

### Cobertura
| Estado | Tem entrada? | Tem saída? |
|--------|--------------|-----------|
| new | sim (inicial) | sim |
| qualifying | sim | sim |
| qualified | sim | sim |
| disqualified | sim | terminal |
| converted | sim | terminal |

### Eventos Inválidos
| Estado | Evento | Comportamento |
|--------|--------|---------------|
| qualified | qualification_started | log + erro 'já qualificado' |

### Gaps
- ⚠️ {estados sem entrada ou saída, transições sem guarda, loops sem condição de saída}
```

## Critério de Conclusão

DONE quando: estado inicial e terminais identificados, toda transição com evento+guarda+ação, todo par (estado, evento) inválido tratado, sem estado órfão.
