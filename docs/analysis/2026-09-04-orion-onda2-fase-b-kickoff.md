# Onda 2 Fase B — kickoff (linguagem 46589)

**Orquestrado por:** Orion  
**ACK Victor 04/09 ~12:50 BRT:** commit/publish Fase A; **não** export `94831`; **não** religar.  
**Esta etapa:** briefing. **Não** é cola. **Não** abre o dashboard TESS.

Squad: `prompt-engineering-squad` (`.aios-core/squads/prompt-engineering-squad/`).  
Etapa 1: `@prompt-briefer` · motor Grok 4.6 High. Writer/eval = Composer Fast **depois** do briefing e do teu gate.

---

## O que é a Fase B

A Fase A (código, neste publish) ensina o **filtro e o classificador** a ouvir o chão. A Tess **ainda** pode falar errado se o prompt 46589 mandar o contrário ou vazar scratch.

Fase B = **recalibrar a linguagem do agente 46589** (o bloco que se cola no TESS), com o mesmo rito do squad: briefing → anatomia → redação versionada → eval → **gate humano (Victor)** → só então cola.

Vivo hoje: `docs/prompts/tess-conversa-v3-clean.md` (**v3.2.1**). Não copiar o arquivo neste kickoff.

---

## O que entra (candidato — o writer ainda não redige)

| # | Falha Mira | O que o prompt precisa **dizer** | Já tem dente no código? |
|---|---|---|---|
| 1 | `1000` / `4501` pezinho → pedicure / timeout | Pezinho do cabelo = acabamento/contorno. **Não** é pedicure. **Não** é combo Cabelo e Barba. Se o snapshot não tiver SKU, não inventar — handoff. | Sim (FILTER + DISAMBIGUA). Prompt reforça o modelo. |
| 2 | `4749` Masculino → Corte Feminino | Gênero dito pelo cliente **fica**. Não voltar ao feminino por omissão. | Sim (`genderQualifier` sessão). Prompt = 2ª linha. |
| 3 | `4749` / `0330` leak TA, Validação, HABILITACAO, ID Trinks | Nunca escrever `TA -`, `[Validação rápida…]`, `Consultando HABILITACAO`, `ID 14129543` no WhatsApp. | Sim (strip outbound). Prompt = não **gerar**. |
| 4 | `4905` gloss / tintura | Tintura/gloss = família química do snapshot (coloração/retoque/tonalização). Não afirmar marca Gloss se o snapshot não tem. | Sim (sinónimos). Prompt = não remapear identidade SKU. |
| 5 | `0330` / `2987` maquiador | Cargo ≠ nome. Listar quem o snapshot habilita em Maquiagem. | Parcial (`ROLE_RE`). |

**Fora da Fase B (não misturar):**

- Split / segundo agente 46589
- Desligar Thinking
- Funil CRM
- Fila de crédito / P-BUDGET / UNCERTAIN→MIN
- I3 contínuo / `guard.blocked` 30<60 (`2987` `4749` `2874`) — isso é slot, não prosa
- Religar kill switch
- Paste sem o teu ACK no **diff** da versão nova

---

## Rito (não pular)

```
1. Briefer  — este briefing (etapa 1)
2. Curator  — anatomia (não inventar seção nova)
3. Writer   — diff versionado em tess-conversa-v3-clean.md + archive da v3.2.1
4. Evaluator
5. Gate Victor no diff (o que cola / o que não cola)
6. Release  — só então colar no TESS 46589
```

Kill switch permanece `global=false`. Publicar backend **não** faz a Tess falar. Fase B **também** não religa.

---

## Briefing (etapa 1 — rascunho Orion / Victor)

Ver `docs/prompts/briefings/tess-46589-onda2-fase-b-brief.md`.

**Próximo passo teu:** ACK para o writer redigir o **diff** (ainda sem colar), ou espera o publish Fase A verificar no container.
