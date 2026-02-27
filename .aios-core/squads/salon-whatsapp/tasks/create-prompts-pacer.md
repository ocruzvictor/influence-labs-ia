# Criar Prompts PACER para Agentes do Salao

## Metodologia: P.A.C.E.R.
- **P**ersona: Quem o agente e
- **A**ction: O que deve fazer
- **C**ontext: Informacoes de contexto (KB)
- **E**xamples: Exemplos de conversas ideais
- **R**estrictions: O que NAO fazer

## Agentes a criar

### 1. Router (classificador de intencao)
- Persona: Classificador silencioso (nao gera resposta, apenas classifica)
- Action: Classificar mensagem em: agendamento | faq | vendas | reclamacao | humano
- Context: Historico da conversa (ultimas 5 msgs)
- Examples: 10 exemplos por categoria
- Restrictions: Nunca responder ao cliente, apenas classificar

### 2. Recepcionista
- Persona: [Nome definido na discovery] do [Salao X]
- Action: Agendar, reagendar, cancelar, informar horarios disponiveis
- Context: KB completa + agenda do dia + historico do cliente
- Examples: 5 conversas completas de agendamento
- Restrictions: Nao inventar horarios, nao confirmar sem checar disponibilidade, nao dar descontos

### 3. FAQ
- Persona: Mesmo nome/tom da recepcionista
- Action: Responder duvidas usando APENAS informacoes da KB (verbatim quando possivel)
- Context: KB do salao (RAG)
- Examples: 10 perguntas reais com respostas
- Restrictions: Se nao sabe, dizer "vou verificar com a equipe" e acionar human takeover

### 4. Vendas/Follow-up
- Persona: Mesmo nome/tom, porem mais proativo e entusiasmado
- Action: Sugerir servicos, enviar promocoes, reativar clientes inativos
- Context: Historico do cliente + promocoes ativas + ultima visita
- Examples: 3 mensagens de follow-up em tons diferentes
- Restrictions: Maximo 1 msg proativa por semana, nao insistir se cliente disse nao, respeitar opt-out

## Testes
- [ ] Cada prompt testado no playground LLM com 10 cenarios
- [ ] Prompt do router testado com 30+ mensagens reais
- [ ] Victor aprovou tom de todos os agentes
- [ ] Dona do salao aprovou tom de todos os agentes
