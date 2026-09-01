# Insights Time Técnico Pareto — Reunião 2026-05-22

**Contexto:** Sessão Eco Adventure (Lívia Tagliari, recepção Bonfim, Victor). Foco: arquitetura SDR/atendimento WhatsApp. Aplicáveis ao Studio Tirra.

## Decisões de arquitetura (validam nossas escolhas)

1. **Multi-agente >> monolito.** Mínimo 3 agentes: Conversa (apenas dialoga) + Supervisor (extrai ações da conversa) + Transcrição de áudio. Concluído opcional: Conclusão (detecta fim antes de chamar supervisor).
2. **Supervisor com gatilho, não polling caro.** Lívia roda supervisor 2x/dia para economia de créditos. Para Studio Tirra (precisa reagir rápido), gatilho por *secret-string* no output do Conversa (`[BOOKING_*]`) → supervisor age só no acionamento, não fica lendo o histórico todo a toda hora.
3. **Debounce 15–18s para agrupar mensagens sequenciais (incl. áudios).** Já temos 15s no Kapso. Pessoa manda 3 áudios curtos? Transcreve os 3, concatena, trata como 1 input.
4. **Janela 24h Meta + templates pagos.** Templates de marketing ≈ US$ 0,07/msg. Cadastro de pagamento na BM (na Influence Labs) é pré-requisito para reengajamento. P3 para nosso caso — bot atual responde dentro da janela.

## Engenharia de prompt (aplicar AGORA)

5. **Modelo sistemático + criatividade baixa.** recepção: "flexibilidade pelo texto = IA faz o que quer". Travar pela config do modelo, dar tom-de-voz pelo prompt.
6. **Prompt = HOW/PORQUE. KB = WHAT.** Operacional (como agir, por quê) vai no prompt. Estático (FAQ, ficha de serviços, especificações) vai na KB. **No prompt, descrever os nomes e conteúdos dos arquivos da KB** — senão a IA não sabe quando consultar.
7. **Limpar `**bold**` e decorações inúteis.** Asteriscos viram tokens, IA "lê com preguiça" e pula linhas. Manter `#` para hierarquia.
8. **Prompt muito grande = IA pula instruções.** recepção: "IA lê como humano com preguiça — introdução, meio, fim, pula o miolo". Refatorar prompt monolito ("Megazord") em prompts menores especializados por agente.
9. **Framework explícito.** Crisp (segmentação fina, bom para SDR/qualificação) ou PACER ou outro — *justificar a escolha*. Pacer já é nosso baseline; revalidar contra Crisp para o Conversa.
10. **Modelo: Sonnet ideal mas caro.** Gemini 2.5 Pro / 3 Flash funcionam bem com contexto longo. Haiku barato mas frágil — exige criatividade baixíssima. GPT-4 "foge" do script (já confirmado em campo).

## Para o nosso roadmap

- **P0:** Aplicar #5, #6, #7, #8 no prompt do Conversa (46589). Reescrever em Crisp ou Pacer enxuto.
- **P0:** Escrever prompt do Supervisor (46590) com gatilho por `[BOOKING_*]`, não por polling.
- **P1:** Agente de transcrição de áudio (recepção: "todo mundo manda áudio no WhatsApp").
- **P2:** Booking 2-phase (não dizer "agendado" antes da Trinks confirmar).
- **P3:** Templates Meta + payment method na BM IL para janela > 24h.
