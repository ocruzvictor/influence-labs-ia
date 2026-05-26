# Task: capturar-briefing — Capturar briefing do agente

```yaml
task:
  id: capturar-briefing
  name: "Capturar briefing do agente"
  agent: prompt-briefer
  command: "*capturar-briefing"
  version: "0.1.0"
  etapa_workflow: 1
  gaps_fechados: [G15, G16]
```

## Objetivo

Produzir briefing estruturado que declare tipo de agente, canal, objetivo de negócio e escopo/cliente — pacote de entrada para a seleção de anatomia.

## Entradas Necessárias

Antes de executar, exija do solicitante:
1. **Tipo de agente** — DEVE ser Tipo 4 (autônomo conversacional). Outros tipos = veto.
2. **Canal** — onde o agente opera (WhatsApp, web, voice etc.).
3. **Objetivo de negócio** — uma frase verbo+objeto+critério de sucesso.
4. **Escopo/cliente** — projeto e cliente alvo (parametriza reutilização cross-scope).
5. **Restrições conhecidas** — vocabulário proibido, integrações obrigatórias, compliance.

Se qualquer item ausente, BLOQUEIA: devolve ao solicitante com a lista do que falta. Não improvisa.

## Workflow de Execução

### Fase 1: Coleta dirigida

Aplica template `templates/briefing-tmpl.md` campo a campo. Para cada campo, registra fonte (quem declarou, quando). Sem fonte = campo vazio = block.

### Fase 2: Verificação de tipo

Confirma que `tipo_de_agente == "Tipo 4"`. Se Tipo 2, 5 ou outro: 🛑 VETO — v1 do squad só cobre Tipo 4.

### Fase 3: Verificação de escopo

Confirma que `escopo` e `cliente` estão preenchidos. Escopo é parâmetro do processo, não inferência. Ausente = block.

### Fase 4: Registro

Salva briefing em `templates/briefing-tmpl.md` preenchido, com `prompt_id` gerado e `current_etapa = etapa_1_briefing`.

## Veto Conditions

(espelho da `etapa_1_briefing` do workflow)

- 🔴 **BLOCK se `tipo_de_agente != Tipo 4`** → devolve ao solicitante com campos faltantes. Responsável pelo desbloqueio: Solicitante.
- 🔴 **BLOCK se escopo/cliente ausente** → devolve ao solicitante com campos faltantes. Responsável pelo desbloqueio: Solicitante.

## Formato de Saída

Briefing estruturado em `templates/briefing-tmpl.md` preenchido, com no mínimo:

```yaml
prompt_id: {gerado}
tipo_de_agente: "Tipo 4"
canal: "{canal}"
objetivo_negocio: "{verbo + objeto + critério}"
escopo: "{projeto}"
cliente: "{cliente}"
restricoes: [{lista}]
fonte_briefing: "{solicitante} @ {timestamp}"
```

## Critério de Conclusão

DONE quando: briefing preenchido satisfaz todos os campos do template, passa nos 2 vetos da etapa 1, e foi registrado com `prompt_id`. Handoff para `etapa_2_selecionar_anatomia` (owner: `prompt-methodology-curator`).

Teste verificável: ler o briefing sem contexto extra responde "qual agente, qual canal, qual objetivo, para qual cliente". Se alguma resposta exige inferência, não está pronto.
