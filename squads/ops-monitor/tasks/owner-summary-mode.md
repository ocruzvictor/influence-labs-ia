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
| `@monitor-reporter *relatorio-completo-teste` | Relatorio do piloto Studio Tirra (janela desde sab 18h) |
| `@monitor-reporter *status-operacao` | Panorama em linguagem simples: quantos atendimentos, erros recentes, fila |
| `@monitor-reporter *resumo-atendimento 47` | Resumo humano so do atendimento #47 |
| `@monitor-reporter *modo-resumo-dono` | Reativa a regra se algum bot voltar a mandar codigo |

## Comando — Relatorio completo do teste (Studio Tirra)

Janela do piloto: **a partir de sabado passado, 18h (horario SP)**.
Ignorar tudo antes das 18h de sabado — recepcao ja tratou.
Atendimentos cujo **primeiro contato** veio do numero antigo com "quero agendar" entram so se forem **depois das 18h de sabado**.

Copie e envie no grupo ou canal do Grok Bot:

```text
@monitor-reporter *relatorio-completo-teste

Preciso do relatorio completo do piloto do bot WhatsApp Studio Tirra (Influence Labs).

=== JANELA DO TESTE (obrigatorio) ===
• Considere SOMENTE atendimentos a partir de SABADO PASSADO, 18:00 (horario de Sao Paulo).
• IGNORE completamente qualquer conversa antes das 18h de sabado — a recepcao ja atendeu essas pessoas.
• Se a primeira mensagem do cliente continha "quero agendar" e veio do numero antigo, inclua apenas se o horario for DEPOIS das 18h de sabado.

=== REGRAS DE LINGUAGEM (para mim, Victor) ===
• Portugues simples. ZERO codigo, JSON, stack trace ou IDs tecnicos.
• Identifique cada cliente por: PRIMEIRO NOME + ultimos 4 digitos do telefone (ex.: Maria ···7766).
• Foco no CONTEXTO: o que o cliente falou, o que a IA respondeu, e POR QUE deu certo ou errado.

=== PARTE 1 — ATENDIMENTOS (do mais recente ao mais antigo) ===

Para CADA atendimento na janela, use este formato:

📱 Atendimento #___
👤 Cliente: [Primeiro nome] ···[last4]
💬 Cliente disse: [resumo fiel do que pediu/perguntou/reclamou]
🤖 IA respondeu: [resumo fiel do que a bot mandou de volta]
✅/❌/🟡 Resultado: [1 frase]
📝 Por que: [1-2 frases — por que deu certo, errado ou ficou pendente]
⏱️ [data/hora SP]

Legenda:
✅ = resolvido pela IA (agendou, respondeu FAQ, encaminhou certo)
❌ = falhou (erro, resposta errada, cliente saiu sem solucao)
🟡 = pendente ou precisa da recepcao/IA

=== PARTE 2 — RESUMO DE AGENDA (obrigatorio) ===

Monte uma visao so de AGENDAMENTOS na mesma janela (sab 18h em diante):

📅 RESUMO DE AGENDA

🔵 Horarios SOLICITADOS (cliente pediu, ainda nao fechou):
• [Nome ···last4] — pediu [dia/horario/servico/profissional se souber] — status: [em aberto / aguardando lead / aguardando recepcao ou IA]

🟢 CONFIRMADOS (agenda fechada com sucesso):
• [Nome ···last4] — [servico] — [dia/hora] — com [profissional se souber]

🟠 REMARCADOS:
• [Nome ···last4] — de [data/hora antiga] para [nova] — [confirmado ou pendente]

🔴 CANCELADOS:
• [Nome ···last4] — [servico/data que cancelou] — [motivo se souber]

🟡 EM ABERTO — falta confirmacao do LEAD (cliente ainda nao confirmou):
• [Nome ···last4] — [o que ficou pendente e o que falta o cliente responder]

🟡 EM ABERTO — falta confirmacao da RECEPCAO ou IA (salao precisa agir):
• [Nome ···last4] — [o que ficou pendente e o que a recepcao/IA precisa fazer]

Se nao houver itens em alguma categoria, escreva "Nenhum".

=== PARTE 3 — FECHAMENTO ===

📊 RESUMO GERAL
• Total na janela (sab 18h+): ___
• ✅ Deu certo: ___
• ❌ Deu errado: ___
• 🟡 Pendente / recepcao: ___

🔴 PRIORIDADE PARA A RECEPCAO HOJE
Liste so os que precisam acao humana agora — nome ···last4 + 1 frase do que fazer.

⚠️ PROBLEMAS REPETIDOS
Padroes que se repetiram (ex.: "3x bot nao achou horario na sexta") — linguagem normal, sem codigo.

Se faltar dado, marque 🟡 "precisa conferir" — nao invente horario nem confirmacao.

Comece quando estiver pronto.
```

### Atalho — so pendencias de agenda para a recepcao

```text
@monitor-reporter *relatorio-completo-teste

Mesmas regras: janela sab 18h+, linguagem simples, primeiro nome + last4, sem codigo.

Me manda APENAS:
1) PARTE 2 (Resumo de Agenda) — especialmente 🟡 em aberto (lead e recepcao/IA) e 🔴 cancelados se relevantes
2) PRIORIDADE PARA A RECEPCAO HOJE

Ignore atendimentos ✅ ja resolvidos, salvo se impactarem agenda em aberto.
```

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
