# Modo Resumo Dono — Comunicacao clara no Grok Bot

## Objetivo
Separar comunicacao tecnica (entre agentes) de comunicacao humana (com Victor/dono do projeto) no grupo de monitoramento vinculado ao Grok Bot.

## Contexto do deploy (VPS)
- Stack: Meta Cloud API + n8n + Chatwoot + TESS (`infra/docker-compose.yml`)
- Workflow principal: `WF-META-01-bot-principal.json` (Studio Tirra)
- Alertas de erro: `ALERT_WEBHOOK_URL` no WF-01-router
- Monitor AIOS (dev): hooks em `.aios-core/monitor/` → porta 4001

## Comando para colar no grupo Grok Bot

Copie e envie **uma vez** no grupo. Os bots mantem a regra da sessao.

```text
@monitor-reporter *modo-resumo-dono

Regra permanente neste grupo:

ENTRE VOS (agentes/bots):
→ Continuem com logs tecnicos: JSON, messageId, intent, confidence, workflow, erros com codigo.
→ Isso e para registro e debug. Nao mudem.

COMIGO (Victor):
→ Nunca me mandem codigo, JSON ou stack trace.
→ Me falem em portugues simples, como um funcionario me atualizando.
→ Use sempre este formato:

📱 Atendimento #___
👤 Cliente: ___
💬 Pediu: ___
🤖 Bot: ___
✅/❌/🟡 Resultado: ___
⏱️ ___ (horario SP)

Exemplos de resultado:
✅ Agendou corte sexta 15h com a Ana
❌ Nao achou horario livre na data pedida
🟡 Passou pro atendimento humano — cliente irritado

Quando eu perguntar "como ta a msg 47?" ou "resumo do atendimento 12", respondam so nesse formato.

Confirmem: "Modo resumo-dono ativado ✅"
```

## Comandos rapidos no dia a dia

| Voce manda no grupo | O que esperar |
|---|---|
| `@monitor-reporter *status-operacao` | Panorama em linguagem simples: quantos atendimentos, erros recentes, fila |
| `@monitor-reporter *resumo-atendimento 47` | Resumo humano so do atendimento #47 |
| `@monitor-reporter *modo-resumo-dono` | Reativa a regra se algum bot voltar a mandar codigo |

## Exemplo — ANTES vs DEPOIS

**Antes (tecnico demais):**
```json
{"workflow":"WF-01-router","error":"intent_parse_failed","phone":"5511999998888","message":"quero marcar"}
```

**Depois (para Victor):**
```text
📱 Atendimento #47
👤 Cliente: Maria (***8888)
💬 Pediu: marcar um horario
🤖 Bot: nao conseguiu entender direito o pedido
❌ Resultado: resposta generica enviada — precisa revisar
⏱️ 14:32 (SP)
```

## Checklist
- [ ] Comando colado no grupo Grok Bot
- [ ] Bot confirmou "Modo resumo-dono ativado ✅"
- [ ] WF-07 importado no n8n e IDs ajustados em WF-01 / WF-META-01
- [ ] `ALERT_WEBHOOK_URL` apontando para webhook do Grok Bot
- [ ] Teste: pedir `*resumo-atendimento` de um atendimento real recente
- [ ] Validar que alertas chegam com campo `owner_summary` legivel
- [ ] Validar que logs tecnicos continuam em `technical` (nao para Victor)
