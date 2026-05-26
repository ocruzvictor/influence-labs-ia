# Multi-Agent Orchestration — Studio Tirra WhatsApp Bot

**Data:** 2026-05-25
**Autores:** @analyst (Alex) + @pedro-valerio (Process Absolutist)
**Status:** Proposta de arquitetura — depende de decisão Victor antes de implementar
**Decisões já travadas:** Multi-agente, Kapso coexistência, TESS LLM, Trinks API, whitelist
**Não toca:** backend em produção (mudanças exigem aprovação explícita)

---

## 1. Topologia de agentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WhatsApp (cliente)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │ msg (texto, áudio, imagem)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Kapso (coexistência, debounce 15s)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ webhook batch
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Backend Node.js — orquestrador determinístico                      │
│   • HMAC + whitelist + dedupe + sessionState                         │
│   • Detecta tipo de cada mensagem do batch                           │
└──┬─────────────────┬───────────────────────┬────────────────────────┘
   │ áudio           │ texto                  │ image/sticker
   ▼                 │                        ▼
┌────────────┐       │                  ┌─────────────────┐
│ AGENTE 1   │       │                  │ Ignorar +       │
│ Transcrição│──────►│ texto concatenado│ pedir texto     │
│ (Whisper-  │       │                  │ ("não consigo   │
│  like API) │       │                  │  ler imagem")   │
└────────────┘       ▼                  └─────────────────┘
              ┌──────────────────────────────────────┐
              │ AGENTE 2 — CONVERSA (TESS 46589)      │
              │ • Persona Studio Tirra                │
              │ • Apenas dialoga + decide AÇÕES via   │
              │   secret-string tags no output:       │
              │     [BOOKING_CREATE] / [BOOKING_CANCEL] /     │
              │     [BOOKING_RESCHEDULE] / [HANDOFF_HUMAN]    │
              │ • Modelo sistemático, criatividade ↓  │
              └──────────────────┬───────────────────┘
                                 │ resposta + tags
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
        ┌──────────────┐  ┌────────────┐  ┌────────────────┐
        │ Parser de    │  │ Reply ao   │  │ AGENTE 3 —     │
        │ tags →       │  │ cliente    │  │ SUPERVISOR     │
        │ Trinks API   │  │ (Kapso     │  │ (TESS 46590)   │
        │ + DB         │  │  send)     │  │ acionado por:  │
        │              │  │            │  │ • tag presente │
        │ (2-phase —   │  │            │  │ • escalation   │
        │  ver doc     │  │            │  │ • cron 4x/dia  │
        │  separado)   │  │            │  │   (varredura)  │
        └──────────────┘  └────────────┘  └────────┬───────┘
                                                   │
                                                   ▼
                                          ┌────────────────┐
                                          │ Notifica Tiago │
                                          │ (humano) via   │
                                          │ canal interno  │
                                          └────────────────┘
```

## 2. Agentes — responsabilidades segregadas

### AGENTE 1 — Transcrição
- **Função:** áudio → texto. Sem contexto da conversa.
- **Implementação:** chamada direta a Whisper/Deepgram/OpenAI Audio (provider TBD). NÃO usa TESS — desperdício caro.
- **Output:** texto concatenado ao batch antes do AGENTE 2 ver.
- **Falha modo:** se transcrição falhar → responder "não consegui entender o áudio, pode digitar?" sem chamar AGENTE 2.
- **Status atual:** existe rascunho no TESS, não implementado. **P1 — alta prioridade.**

### AGENTE 2 — Conversa (TESS 46589)
- **Função única:** dialogar com o cliente em tom Studio Tirra. Coletar dados. Apresentar opções. **Não executa ações, apenas as solicita via tags.**
- **Entrada:** texto + contexto dinâmico (slots, serviços, profissionais, histórico, dados cliente) injetado pelo backend.
- **Saída:** mensagem para o cliente + (opcional) uma ou mais tags `[BOOKING_*]` ou `[HANDOFF_HUMAN]` ou `[ESCALATE]`.
- **Modelo:** sistemático + criatividade baixa (decisão validada pela Pareto).
- **Status atual:** funcional, qualidade "mais ou menos". Redesign em `tess-conversa-v2.md`.

### AGENTE 3 — Supervisor (TESS 46590)
- **Função:** auditar qualidade, detectar escalações, sinalizar Tiago.
- **Gatilhos (3 modos coexistem):**
  1. **Síncrono por tag:** Conversa emitiu `[HANDOFF_HUMAN]` ou `[ESCALATE]` → backend chama Supervisor imediatamente.
  2. **Síncrono por heurística:** sessão > N turnos sem progresso, ou sentimento negativo detectado → chama Supervisor.
  3. **Assíncrono cron 4x/dia:** varre conversas das últimas 6h, marca aquelas que precisam atenção humana mas o Conversa não detectou.
- **Saída:** decisão estruturada (`{escalate: bool, reason: string, severity: low|med|high}`) + notificação a Tiago se severity >= med.
- **Status atual:** rascunho. Prompt completo em `tess-supervisor-v1.md`.

## 3. Por que separar (princípio Gabriel Bonfim)

> "IA lê prompt como humano com preguiça. Prompt grande = pula instruções."

Conversa monolítico hoje tenta: dialogar + qualificar + decidir ação + auditar + transcrever. Resultado: pula script, esquece confirmação, inventa horário. Separar = cada agente tem 1 prompt curto e foco único → maior aderência.

## 4. Interfaces entre agentes (contratos)

### Backend → Conversa (input)
```
{
  texto_cliente: string,           // batch concatenado pós-transcrição
  contexto_dinamico: {
    HOJE: "2026-05-25",
    SLOTS_DISPONIVEIS: [...],      // Trinks
    SERVICOS: [...],
    PROFISSIONAIS: [...],
    DADOS_CLIENTE: {...},
    HISTORICO_CONVERSA: [...]      // últimas N msgs
  }
}
```

### Conversa → Backend (output)
```
{
  reply_text: string,              // o que o cliente vai ler
  tags: [                          // 0+ tags estruturadas
    "[BOOKING_CREATE servicoId=X profissionalId=Y dataHora=ISO]",
    "[HANDOFF_HUMAN motivo=...]"
  ]
}
```

### Conversa → Supervisor (trigger síncrono)
```
{
  conversationId: string,
  ultimas_N_msgs: [...],
  tag_acionadora: "[HANDOFF_HUMAN motivo=reclamacao]"
}
```

### Supervisor → Backend (output)
```
{
  decision: "escalate" | "monitor" | "ignore",
  severity: "low" | "med" | "high",
  reason_for_human: string,        // mostrado ao Tiago
  suggested_action: string         // opcional
}
```

## 5. Escalação humana — fluxo

1. Cliente diz algo como "quero falar com pessoa", "atendente", "reclamação", "isso é inaceitável", ou Conversa detecta que não consegue responder após 2 turnos.
2. Conversa emite `[HANDOFF_HUMAN motivo=...]` + responde algo neutro tipo "Vou pedir ao Gabriel pra continuar com você daqui, ok?".
3. Backend marca a conversa como `humano_assumiu=true` no sessionState (já temos TTL 3h em memória).
4. Supervisor confirma o motivo e dispara notificação a Tiago (canal: WhatsApp interno? Email? Definir P0).
5. **Bot fica silencioso para aquele número até `human_takeover_expires`** (que já existe na lógica `whatsapp.message.sent origin != cloud_api`).

## 6. Cron do Supervisor — varredura

- **Frequência sugerida:** 4x/dia (08h, 12h, 16h, 20h horário do salão). Lívia roda 2x; Studio Tirra precisa um pouco mais por causa do volume baixo + criticidade do agendamento.
- **Janela:** últimas 6 horas, conversas com mensagens novas.
- **Filtro:** ignorar conversas com `humano_assumiu=true` (Tiago já está nelas).
- **Detecção:** sentimento ruim, perguntas repetidas (cliente reformulou 2x), silêncio > 30min com Conversa "no meio da conversa".

## 7. O que NÃO entra nesta arquitetura (decisões anti-overengineering)

- ❌ **Agente Roteador** (`router`) — backend determinístico já faz isso. Acrescentar LLM = lentidão + custo + falha modes a mais.
- ❌ **Agente de Conclusão** (verificar se conversa "terminou") — gatilho por tag + cron resolve sem custo extra.
- ❌ **Agente de Vendas separado** — Conversa já tem persona consultiva. Separar = perder o tom natural.
- ❌ **Memory store próprio** — `conversation_history` no Postgres já cobre.

## 8. Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Conversa esquece de emitir tag → ação não acontece | Supervisor cron 4x/dia pega o que escapou |
| Supervisor emite escalação errada (falso positivo) | Severity baixa não acorda Tiago, só registra |
| Custo TESS multiplica com 2 agentes | Supervisor é raro (tag-gated) — custo marginal |
| Transcrição quebra | Fallback: "manda texto" — sem cascata pra Conversa |
| Backend muda contrato → todos quebram | Versionar contratos no código (já temos uma estrutura) |

---

**Próximo passo:** Victor valida a topologia → implementa Supervisor (prompt pronto em `tess-supervisor-v1.md`) → depois transcrição (P1) → depois 2-phase booking (P2).
