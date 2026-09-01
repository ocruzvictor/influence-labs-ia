# Relatório — melhores práticas vs prompt 46589

## 1. Tamanhos reais (para matar o mito)

| Artefato | Palavras | ~tokens PT | O que aconteceu na prática |
|---|---:|---:|---|
| Tirrá `tess-conversa-v3-clean.md` | 2.621 | **~3.500** | Smoke a recepção: habilitação OK, bordas FAIL |
| Flora `sdr-prompt-v3-tess-ready.md` | 3.253 | ~4.400 | PACER no TESS; eval 9.4 depois no Gemini |
| Flora `sdr-prompt-v4.2-gemini-ready.md` | 5.178 | **~7.000** | Qualidade **subiu** com prompt **maior** |

Se “grande” fosse a causa, a Flora teria piorado no v4. Não piorou. O ganho veio de **estrutura + medição + runtime**, não de token count.

Além do system prompt, o 46589 injeta a cada turno (`backend/server.js`):

- `SERVICOS DISPONIVEIS` **completo** (`getServicesText()` — 119 SKUs, sem filtro de intenção)
- `HABILITACAO` + `HORARIOS VAGOS` 10 dias
- histórico `LIMIT 15`
- KB TESS (faq, fichas, sinônimos, padrões de fala)

Isso é o haystack. O prompt de 3,5k é só o índice.

## 2. O que o mercado mede (2025–2026)

### Context rot (Chroma, jul/2025)

18 modelos frontier: a qualidade **cai com o comprimento do input**, ainda dentro da janela declarada. Não é “estourou 128k”. É atenção finita. [Chroma / síntese](https://hivetrail.com/blog/context-rot-chroma-study).

### Lost in the middle (Liu et al., Stanford)

Curva em U: fato no **meio** do contexto é ~30% pior que no começo ou no fim. No 46589 isso descreve o smoke: REGRA ZERO (topo) e NUNCA (rodapé) competem com I.4/I.6/I.8 no meio — e a promo terça/quarta foi exatamente o hedge contraditório no meio da bolha.

### Context engineering (Anthropic, set/2025)

[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):

> “find the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome.”

E o caveat que importa para nós:

> “minimal does not necessarily mean short; you still need to give the agent sufficient information up front.”

Altitude: nem if-else quebradiço, nem “seja prestativa”. Constituição + exemplos canônicos, **não** lista de 40 edge cases. Few-shot: poucos e diversos; não stuffing de exceção.

### Densidade semântica (SDE, 2026)

Não é “menos tokens”. É informação por token. Prompt diluído (repetir a mesma regra em I, P, STYLE e exemplos) perde para um bloco denso. O 46589 hoje **repete** 1 bolha, preço de um profissional, e habilitação em 3–4 lugares — ruído, não densidade.

Blogs que vendem “200 tokens vencem 4000” ([Tian Pan](https://tianpan.co/blog/2026-05-02-200-token-system-prompt-beats-4000-token-one), [TokenMix](https://tokenmix.ai/blog/prompt-engineering-guide)) valem para classificação / Q&A simples. **Não** para agente de agenda com tags, habilitação e combo. Anthropic é a fonte mais alinhada ao nosso tipo de agente.

### WhatsApp de negócio

Padrão 2026 (Ayala, Bravos, AGIX):

1. System prompt = identidade + recusa + formato. Curto.
2. Fatos (preço, horário, catálogo) = **RAG ou snapshot filtrado**, nunca encyclopedia no system.
3. Ação (criar/cancelar) = **tool / backend**, com guarda — o modelo não é a última linha de defesa.
4. Handoff humano é feature, não falha.

O Tirrá **já faz** (2) e (3) em parte: snapshot Trinks + tags `BOOKING_*`. O furo é mandar o catálogo **inteiro** e deixar o modelo ser a última linha em expediente e idempotência.

## 3. O que o Eco Adventure realmente trocou

Não foi “PACER → prompt curto”.

| Camada | Antes | Depois | Efeito |
|---|---|---|---|
| Provider | TESS objeto-agente | Gemini HTTP (`contents[]`) | Controle de histórico; eval offline barato |
| Anatomia | PACER + FAFAC (piloto v3) | Mesma persona, **limites no topo**, tabela Use/Nunca, trip-wire no **fim** | Kill-rules deixam de ser rodapé |
| Fatos | Tudo no prompt/KB | RAG + `package-facts` + MATERIALS_MAP | Prompt não carrega catálogo |
| Medição | Benchmark frágil | Rubrica 9.3: D/K/Q, gate **binário em K** | 97% estrutura + 1 K3 = FAIL |
| Runtime | n8n + prompt | Guards de código (anti-echo, outbound idempotency, slot) | Sintoma “bot ruim” era plumbing |

Lição do `9.4-relatorio-aderencia-FINAL.md`: dois modelos diferentes erravam **cenários diferentes** no mesmo trigger sub-especificado. Subir modelo não consertou. **Especificar o gatilho + medir** consertou.

Isso mapeia 1:1 na recepção: habilitação (escrita, explícita) PASS; expediente (não escrito) FAIL. Tamanho do PACER não é a variável.

## 4. Harness atual do Tirrá vs o que o mercado usa

Existe `scripts/test-conversa-v3.mjs`. Ele está **desatualizado em relação à produção**:

- Injeta `SLOTS_DISPONIVEIS` JSON — o backend injeta `HORARIOS VAGOS` texto
- Preços de teste Erick R$70 / Tiago R$100 — snapshot 17/08 é R$90 / R$105 / R$190 / R$250
- Critérios ainda falam de `<break>` (I.10 atual **proíbe**)
- Score 7/10 com threshold 0,85; **sem kill-rule** — uma conversa que cria 7 bookings ainda “passaria” em tom
- O próprio baseline (`conversa-v3-eval-baseline-v2.md`) admite: rodou contra prompt v2 no painel

Flora 9.3 é o molde certo: checks determinísticos (regex/tag/grade) + kills que sozinhas reprovam + qualitativos 0–2. O Atlas já rascunhou isso para o 46589 em `docs/analysis/recepcao-smoke-aderencia-2026-08-18.md` (K1–K8).

Golden set natural: os 14 turnos da recepção + os smokes 17/08 (Dylan, preço Tiago, combo).

## 5. Devil’s advocate — e se só encolher o prompt?

Risco alto. As falhas da recepção são **ausência de regra**, não excesso. Apagar I.4/I.6/exemplos sem K1–K8 no harness reproduz o v2: comparativo de preço, markdown, `<break>`.

O que **pode** encolher com segurança: duplicatas (1 bolha dita 4 vezes), exemplos com `<break>` mortos, ROLE “premium” vs NUNCA “premium”, few-shots que não cobrem expediente/idempotência.

O que **não** deve ir para o system prompt: 119 SKUs, 10 dias de grade de todo mundo, fichas técnicas. Isso é snapshot **por intenção** (“André + corte + sexta”) ou tool.

## 6. Arquitetura alvo (consenso mercado + Flora + Tirrá)

```
[Constituição curta]
  limites absolutos no topo
  vocabulário Use/Nunca
  trip-wire no fim (6 linhas)
[Contexto dinâmico FILTRADO]
  só prof/serviço/dia relevantes ao turno
[Memória compacta]
  6–8 turns, não 15 crus
[Backend como guarda]
  idempotência CREATE, recusa fora do expediente, copy I.8
[Harness]
  golden recepção + kills K1–K8, gate binário
```

Isso **é** troca de framework, no sentido Anthropic (context engineering), não no sentido “jogar PACER fora e colar um prompt de 200 tokens”.
