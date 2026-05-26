# Waitlist Studio Tirra — Feedback Estruturado (Fase 1)

**Data da sessão:** 2026-05-26
**Facilitador:** @analyst (Atlas)
**Modo:** Validação (hipóteses prontas, estresse-teste antes de virar prompt v3)
**Janela dos feedbacks:** desde ajuste de madrugada 2026-05-26 → tarde 2026-05-26
**Frente:** A — Refinamento UX agente Conversa
**Próximo agente:** @prompt-briefer (Fase 2)

---

## 1. Whitelist ativa

| Quem | Final do número | Papel |
|------|-----------------|-------|
| Tiago Rocha | `…0330` | Dono Studio Tirra, testador primário |
| Victor Cruz | `…0007` | Founder Influence Labs |
| Terceiro testador | `…2495` | — |

---

## 2. Captura literal dos feedbacks (sem invenção)

| ID | Quem | Categoria | Observação bruta | Severidade |
|----|------|-----------|------------------|------------|
| F1 | Tiago | Tom/voz | Ao listar profissionais para corte, agente respondeu: "Tiago e André = R$100 (premium), Eric = R$70". Soa depreciativo pro Eric e pra marca do salão. | Alta |
| F2 | Tiago | Cobertura léxica (KB) | Cliente escreveu "pé"; agente não interpretou como pedicure. Mapeamento de sinônimos só existe pra corte/barba. | Média |
| F3 | Victor | Quebra de mensagens | Respostas do agente vêm em blocos de 4-5 linhas em uma única bolha. WhatsApp humano-humano usa várias mensagens curtas em sequência. Exceção: confirmações estruturadas. | Alta |
| F4 | Victor | Factual / fluxo booking | Suspeita de que agente ofereceu slot de 30min pra pedicure, possivelmente abaixo da duração real do serviço. Sem confirmação ainda — vale auditar. | Média |

---

## 3. Sessão de validação — 5 Whys + Pre-Mortem

### F1 — Preço depreciativo (5 Whys)

1. Por que soa depreciativo? Coloca Eric numericamente "abaixo" dos demais.
2. Por que isso é problema? Preço no contexto salão = senioridade percebida; R$70 vs R$100 lê como "iniciante vs sênior".
3. Por que importa pro Tiago? Eric faz parte do time; cliente lendo "depreciação" da equipe machuca a marca do salão, não só o profissional.
4. Por que o agente listou assim? Cliente pediu valor pra cortar com Tiago; agente respondeu o valor + ofertou alternativas com preço (tentando ser útil).
5. **Root cause:** a violação não é "listar preço" — é **listar preços comparativos sem ser solicitado**. Regra precisa ser cirúrgica, não absoluta.

### F3 — Quebra de mensagens (5 Whys)

1. Por que blocões incomodam? Visualmente densos, quebram a cadência conversacional do WhatsApp.
2. Por que cadência importa? Cada bolha = turno de fala; bolha gigante soa como "ele está despejando", não conversando.
3. Por que o agente faz blocão? TESS por design retorna payload único; sem instrução explícita vira uma mensagem só.
4. Quando blocão É aceitável? Confirmação estruturada de reserva (data/hora/serviço/profissional/valor) — usuário espera bloco formal nesse ponto.
5. **Root cause:** falta regra de splitting — padrão deve ser 2-4 bolhas curtas; exceção explícita pra confirmações estruturadas.

**Constraint técnico descoberto:** TESS não envia múltiplas mensagens; quem quebra é o **backend**. Solução tem 2 pontas — (a) prompt insere separador, (b) backend faz `split()` tag-aware com `typing_indicator` entre bolhas.

### Pre-Mortem — v3 deployed, falhou em 7 dias. Por quê?

| Cenário | Prob. | Mitigação |
|---------|-------|-----------|
| Quebra virou ruído — 8 bolhas pra resposta simples | Média | Bateria de teste com count esperado de bolhas por tipo de resposta |
| Agente ficou evasivo sobre preço — desvia quando perguntado direto | Média | Regra explícita: pergunta direta → resposta direta. Evitar **apenas listagem comparativa não-solicitada** |
| Backend split quebrou tags inline (`<reservar>` dividido entre bolhas) | **Alta** | Splitter **tag-aware** — regex que nunca corta dentro de `<...>...</...>` |
| Typing indicator entre bolhas atrasou demais | Baixa | Delay ≤ 1.2s; bench com conversa real |
| Tiago percebe agente "frio" sem comparação | Baixa-Média | Calor via adjetivos sobre profissional, não via preço |

> **Achado crítico:** risco #3 (tag-aware split) é técnico e bloqueante — se o splitter cortar `<reservar>` no meio, pipeline de booking explode em prod.

---

## 4. Síntese — Regras candidatas

### Pro prompt v3 (escopo Frente A, Fase 3)

- **R1.** Pergunta de preço de UM profissional → responder o preço solicitado; ofertar alternativa só se cliente pedir explicitamente comparação ("tem mais em conta?", "outros profissionais?").
- **R2.** Nunca listar valores de profissionais em formato comparativo sem solicitação explícita.
- **R3.** Calor humano via **qualidade do profissional** (ex: "Eric é ótimo em corte clássico"), nunca via **diferencial de preço**.
- **R4.** Inserir separador (`<break>` ou `\n\n` — definir no briefing) em pontos de quebra natural. Confirmação estruturada de reserva permanece bloco único.

### Fora do prompt — owners separados

- **A1. (F2 — KB)** Expandir KB de sinônimos pra pedicure, manicure, sobrancelha, depilação, hidratação, etc. Owner: editor KB. Ex: "pé" → pedicure, "mão" → manicure.
- **A2. (F4 — regra booking)** Auditar uso de `duracaoMinutos` real do serviço Trinks ao calcular slots ofertados (não default 30min). Owner: @dev. Tarefa: instrumentar log em `backend/server.js:processMessage` quando slot ofertado tem duração ≠ catálogo.
- **A3. (tag-aware split — backend)** Implementar `splitMessage(text)` no backend que respeita tags inline (`<reservar>`, `<cancelar>`, etc.) e quebra apenas em separadores explícitos do prompt. Owner: @dev. Pré-requisito do deploy v3.

---

## 5. Prioridade pra Fase 2 (briefing v3)

**Entram no briefing v3:** R1, R2, R3, R4 + constraint A3 (splitter tag-aware deve estar pronto antes do deploy).

**Não entram (epics/issues separadas):** A1 (KB), A2 (booking audit).

**Restrições conhecidas (lembrete pro @prompt-briefer):**
- TESS temperatura 0.4 (não mexer)
- Manter estrutura PACER/Crisp do v2
- Manter tags inline v2 (`<reservar>`, `<cancelar>`, etc.)
- Sem novos recursos funcionais

---

## 6. Handoff pra Fase 2

**Próximo comando:**

```
@prompt-briefer
*brief sobre conversa v3 — input: docs/feedback/2026-05-26-waitlist-feedback-structured.md
```

**Output esperado da Fase 2:** `docs/prompts/briefings/conversa-v3-brief.md`

---

*Sessão facilitada por @analyst (Atlas) — método: 5 Whys + Pre-Mortem. Fonte: feedbacks transmitidos verbalmente por Victor em 2026-05-26 (Tiago + Victor; Gabriel sem feedback nesta janela).*
