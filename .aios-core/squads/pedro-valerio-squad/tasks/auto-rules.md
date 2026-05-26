# Task: auto-rules — Criação de Regras de Automação

```yaml
task:
  id: auto-rules
  name: Regras de Automação
  agent: pedro-valerio
  command: "*auto-rules {sistema}"
  version: "1.0.0"
```

## Objetivo

Criar regras de automação determinísticas com triggers verificáveis, condições explícitas e veto conditions que impedem execução incorreta.

## Pré-requisito

⚠️ Antes de criar regras de automação, confirme:
- O processo manual está correto e documentado?
- Se não → use `*eng-map` primeiro. Automação de processo ruim = falha mais rápida.

## Workflow de Execução

### Fase 1: Identificar Gatilhos

Para cada automação, defina:
- **Evento:** o que acontece no sistema que inicia a regra?
- **Fonte:** em qual sistema o evento ocorre?
- **Verificabilidade:** o sistema consegue detectar automaticamente? Se não → não é trigger válido.

### Fase 2: Definir Condições

Estrutura IF/THEN obrigatória:
```
IF {condição verificável por sistema}
AND {condição adicional se necessário}
THEN {ação determinística}
```

Nunca use: "se apropriado", "quando necessário", "em geral".
Cada condição deve ter operador explícito: `=`, `>`, `<`, `!=`, `contains`, `is_null`.

### Fase 3: Especificar Ações

Cada ação deve ser:
- **Determinística:** mesma condição → mesma ação, sempre
- **Atômica:** uma coisa só por ação (não "envie e atualize e notifique")
- **Verificável:** é possível confirmar que a ação foi executada?

Se precisar de múltiplas ações → defina sequência com ordem explícita.

### Fase 4: Veto Conditions

Para cada regra, defina o que a BLOQUEIA de rodar:
- Condições que devem ser false para a regra executar
- Ação de fallback quando vetada
- Log obrigatório para auditoria

### Fase 5: Teste com 3 Casos

Antes de aprovar:
1. **Happy path:** condições ideais — regra deve executar
2. **Edge case:** dados atípicos — regra deve tratar corretamente
3. **Falha:** condição de veto ativa — regra NÃO deve executar

## Formato de Saída

```
## Regras de Automação: {sistema}

### Regra {N}: {nome descritivo}
**Trigger:** {evento no sistema X}
**Condição:**
  IF {campo} {operador} {valor}
  AND {condição adicional}
**Ações (em ordem):**
  1. {ação determinística}
  2. {ação determinística}
**Veto Conditions:**
  - BLOCK se {condição que impede execução}
  - BLOCK se {condição adicional}
**Fallback:** {o que acontece quando vetado}
**Log:** {campo/evento registrado para auditoria}

**Teste:**
  ✅ Happy path: {cenário + resultado esperado}
  ✅ Edge case: {cenário + resultado esperado}
  ✅ Falha: {cenário + resultado esperado — regra NÃO executa}
```

## Critério de Conclusão

DONE quando: todas as regras têm trigger verificável, condições IF/THEN explícitas, veto conditions definidas e 3 cenários de teste descritos.

⚠️ HIPÓTESE: Sempre marcar assunções sobre comportamento de sistema não confirmadas.
