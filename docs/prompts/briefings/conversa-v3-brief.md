# Briefing — Conversa v3 (refactor)

**Versão do template:** v0.1.0
**Owner do preenchimento:** @prompt-briefer
**Data:** 2026-05-26
**Consumidores:** @prompt-methodology-curator (etapa 2), @prompt-writer (etapa 4)
**Modo:** refactor de prompt em produção (não criação do zero)
**Origem:** [docs/feedback/2026-05-26-waitlist-feedback-structured.md](../../feedback/2026-05-26-waitlist-feedback-structured.md)

---

## 1. Identificação

- **id_prompt:** `tess-conversa-v3`
- **escopo/cliente:** `studio-tirra`
- **solicitante:** Victor Cruz (founder Influence Labs) — feedbacks transmitidos verbalmente em 2026-05-26 (Tiago Rocha + Victor; recepção sem feedback nesta janela)
- **data_briefing:** 2026-05-26
- **destino do prompt:** TESS agente `46589` (substituição do v2 ativo)
- **versão base:** [docs/prompts/tess-conversa-v2.md](../tess-conversa-v2.md)

---

## 2. Tipo de agente

- **tipo:** `Tipo 4 — autônomo conversacional`
- **observação:** refactor de Tipo 4 existente em produção; sem mudança de tipo, sem mudança de arquitetura (continua TESS 46589 + KB conversa-v2 + tags inline v2).

---

## 3. Canal

- **canal_principal:** WhatsApp
- **plataforma:** TESS Studio (agente 46589) com camada Kapso na entrega WhatsApp
- **modo de injeção:** system prompt fixo no TESS + contexto dinâmico injetado pelo `backend/server.js:processMessage` (PERFIL DO CLIENTE + HISTÓRICO ANTERIOR + slots Trinks)

---

## 4. Objetivo de negócio

- **objetivo:** Levar o agente Conversa de "funcional" para "soa natural e elegante" — eliminar comparações depreciativas de preço entre profissionais e quebrar respostas longas em 2-4 mensagens curtas no WhatsApp, sem regredir nenhuma funcionalidade (booking, cancelamento, transcrição áudio, after-hours, supervisor matinal).
- **kpi_principal:**
  - Zero ocorrências de listagem comparativa de preços não-solicitada em bateria de testes
  - >= 80% das respostas conversacionais quebradas em 2-4 bolhas (excluindo confirmações estruturadas)
  - Zero regressão em testes existentes de booking/cancelamento/fluxos críticos
- **anti_objetivo:**
  - Agente NÃO pode ficar evasivo sobre preço quando perguntado diretamente sobre UM profissional
  - Agente NÃO pode quebrar tags inline (`<reservar>`, `<cancelar>`, etc.) entre bolhas — pré-requisito técnico do backend
  - Agente NÃO pode perder calor humano ao parar de comparar preços (compensar via qualidade do profissional)
  - NÃO adicionar novos recursos funcionais (booking 3-fase, IA visual, etc. ficam fora do escopo)

---

## 5. Persona resumida

- **nome_persona:** Conversa (sem nome próprio — agente do Studio Tirra)
- **papel:** Atendente conversacional do salão (booking, info, dúvidas, cancelamento)
- **tom:** Informal-acolhedor, calor humano via qualidade do profissional (não via diferencial de preço)
- **público:** Clientes do Studio Tirra (São Caetano do Sul/SP) — atualmente whitelist de 3 telefones: Tiago `…0330`, Victor `…0007`, terceiro `…2495`

---

## 6. Restrições conhecidas

### Restrições técnicas (não negociáveis)

- TESS `temperatura = 0.4` — não mexer
- Manter estrutura PACER/Crisp do v2
- Manter tags inline v2 (`<reservar>`, `<cancelar>`, `<remarcar>`, etc.) — pipeline de booking depende
- TESS não envia múltiplas mensagens — quem quebra é o backend ao receber payload

### Restrições de escopo

- NÃO adicionar features funcionais novas — apenas refinar comunicação
- NÃO mudar arquitetura (continua TESS 46589 + KB conversa-v2)
- NÃO mudar persona base — apenas regras de tom e quebra

### Pré-requisitos técnicos do deploy v3

- **A3 (splitter tag-aware no backend):** implementar `splitMessage(text)` em `backend/server.js` que respeita tags inline (`<...>...</...>`) e quebra apenas em separadores explícitos do prompt. **BLOQUEIA deploy v3** — sem isso, splitter pode cortar `<reservar>` no meio e quebrar booking em produção.
- **Escalonamento humano:** mantém supervisor matinal e human-handoff existentes do v2.

### Itens fora deste briefing (epics/issues paralelas)

- **A1 — KB sinônimos (F2):** expandir mapeamento léxico para pedicure ("pé"), manicure ("mão"), sobrancelha, depilação, hidratação. Owner: editor de KB. Não entra no prompt — é dado.
- **A2 — Audit booking duration (F4):** instrumentar log em `processMessage` quando slot ofertado tem `duracaoMinutos` ≠ catálogo Trinks. Owner: @dev. Não entra no prompt — é regra de booking.

---

## 7. Fontes esperadas

| # | Fonte | Tipo | Owner | Rastreabilidade |
|---|-------|------|-------|-----------------|
| 1 | [docs/feedback/2026-05-26-waitlist-feedback-structured.md](../../feedback/2026-05-26-waitlist-feedback-structured.md) | Primária — feedback estruturado | @analyst (Atlas) | ✅ path local |
| 2 | [docs/prompts/tess-conversa-v2.md](../tess-conversa-v2.md) | Primária — prompt base a refatorar | @prompt-writer (último deploy 2026-05-25) | ✅ path local |
| 3 | [data/kb/conversa-v2/regras-comerciais.md](../../../data/kb/conversa-v2/regras-comerciais.md) | Primária — regras consultadas pelo LLM | Tiago Rocha (Studio Tirra) | ✅ path local |
| 4 | [data/kb/conversa-v2/padroes-fala.md](../../../data/kb/conversa-v2/padroes-fala.md) | Primária — padrões de tom existentes | Studio Tirra | ✅ path local |
| 5 | [data/kb/conversa-v2/fichas-tecnicas-servicos.md](../../../data/kb/conversa-v2/fichas-tecnicas-servicos.md) | Secundária — catálogo de serviços/profissionais | Studio Tirra | ✅ path local |
| 6 | [scripts/test-conversa-v2.mjs](../../../scripts/test-conversa-v2.mjs) e [test-conversa-v2-robust.mjs](../../../scripts/test-conversa-v2-robust.mjs) | Secundária — baseline de eval (v3 estende esta bateria) | @prompt-evaluator | ✅ path local |

**Total:** 4 fontes primárias + 2 secundárias — todas com path verificável, todas no escopo studio-tirra. **Sem vazamento cross-cliente.**

---

## 8. Critérios de sucesso (entrada da etapa de eval)

### Regras-alvo derivadas dos feedbacks (R1-R4)

- **R1 — Preço solicitado direto:** cenário "cliente pergunta valor para cortar com [Profissional X]" → agente responde o preço de X; **só** oferta alternativa se cliente pedir explicitamente comparação ("tem mais em conta?", "outros profissionais?").
- **R2 — Sem comparativo não-solicitado:** em nenhuma resposta o agente lista valores de profissionais em formato comparativo (ex: `Tiago R$100 / Eric R$70`) sem solicitação explícita do cliente.
- **R3 — Calor humano via qualidade:** quando precisa diferenciar profissionais, agente diferencia por **qualidade/especialidade** (ex: "Eric é ótimo em corte clássico"), **nunca** por **diferencial de preço**.
- **R4 — Quebra de mensagens:**
  - Respostas conversacionais devem inserir separador `<break>` (sintaxe a ser definida pelo @prompt-writer) em pontos de quebra natural, resultando em 2-4 bolhas curtas após split no backend.
  - Confirmação estruturada de reserva (data/hora/serviço/profissional/valor) permanece **bloco único** (sem `<break>`).
  - Saudações curtas (uma linha) permanecem **bloco único**.

### Critérios de não-regressão (anti-objetivo verificável)

- **NR1 — Booking funcional:** bateria v2 atual (`scripts/test-conversa-v2-robust.mjs`) passa 100% sem alteração de comportamento de booking.
- **NR2 — Tags íntegras:** nenhuma resposta do v3 produz tag inline quebrada entre bolhas (`<reservar>` ... `</reservar>` sempre na mesma bolha).
- **NR3 — Resposta direta a preço:** cenário "qual o valor pra cortar com Tiago?" → resposta contém valor; **não** evasiva.
- **NR4 — Confirmação estruturada:** cenário "agente confirma reserva" → resposta vem em bloco único (sem `<break>`).

### Métrica agregada do evaluator

- Verdict APROVADO exige: R1-R4 todos passando + NR1-NR4 todos passando.
- Verdict REVISAR: 1-2 regras com falha não-crítica.
- Verdict REJEITAR: 3+ falhas OU qualquer falha em NR1/NR2 (bloqueia booking).

---

## 9. Notas livres

- **Pre-mortem registrado** em `docs/feedback/2026-05-26-waitlist-feedback-structured.md §3` — risco crítico é splitter cortar tag inline. Endereçado por A3 (pré-requisito de deploy, não do briefing).
- **A/B test:** Victor ainda não decidiu janela de tolerância (V2 e V3 alternados por 1 semana? ou direto V3?). Decisão fica para Fase 5 (Deploy).
- **Whitelist permanece a mesma** (3 telefones) durante validação v3. Expansão pós-aprovação do evaluator.
- **Janela de feedback que originou v3:** desde madrugada 2026-05-26 → tarde 2026-05-26 (~12h de uso real).

---

✅ **BRIEFING FECHADO**

- 4 campos obrigatórios preenchidos
- 4 fontes primárias rastreáveis (mínimo atendido)
- Nenhum vazamento cross-cliente
- Restrições técnicas declaradas explicitamente
- Pré-requisito A3 (splitter tag-aware) sinalizado como bloqueio de deploy

**Próximo handoff:** `@prompt-methodology-curator *selecionar-anatomia` — input: este briefing. Output esperado: anatomia de prompt (PACER/Crisp/outra) adequada ao refactor.

Em refactor de prompt v2 existente que já usa PACER/Crisp, a etapa 2 (seleção de anatomia) pode ser fast-track ("manter anatomia v2") — decisão do Methodology Curator, não minha.

---

*Briefing produzido por @prompt-briefer (Tier 2 — prompt-engineering-squad v0.1.0) seguindo `tasks/capturar-briefing.md` e `templates/briefing-tmpl.md`.*

<promise>COMPLETE</promise>
