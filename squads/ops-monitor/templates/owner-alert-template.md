# Template — Alerta para o Dono (Victor)

Use este template em TODA mensagem destinada ao dono do projeto.
Nunca envie JSON, codigo ou IDs tecnicos neste canal.

---

📱 Atendimento #{{numero_atendimento}}
👤 Cliente: {{nome_cliente_ou_telefone_mascarado}}
💬 Pediu: {{resumo_pedido_1_frase}}
🤖 Bot: {{acao_bot_1_frase}}
{{emoji_resultado}} Resultado: {{resultado_linguagem_normal}}
⏱️ {{horario_sp}}

---

## Emojis de resultado
- ✅ = deu certo (agendou, respondeu FAQ, vendeu)
- ❌ = deu errado (erro, nao respondeu, falhou integracao)
- 🟡 = escalou pra humano ou aguardando acao

## Campos tecnicos (NAO enviar ao dono — so log interno)
- messageId: {{meta_message_id}}
- intent: {{intent}} (confidence: {{confidence}})
- workflow: {{workflow_name}}
- error_code: {{error_code}}
