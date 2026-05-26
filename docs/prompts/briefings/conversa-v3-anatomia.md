# Anatomia Selecionada — Conversa v3

**Owner:** @prompt-methodology-curator
**Data:** 2026-05-26
**Etapa do workflow:** 2 (seleção de anatomia)
**Briefing de entrada:** [docs/prompts/briefings/conversa-v3-brief.md](conversa-v3-brief.md)

---

## Classificação do objetivo

**Tipo de objetivo:** agente conversacional consultivo (Tipo 4) com escalonamento humano + persona forte + saída estruturada condicional via tags inline

**Evidência (do briefing):**
- §2 Tipo de agente: "Tipo 4 — autônomo conversacional"
- §3 Canal: "WhatsApp via TESS Studio"
- §4 Objetivo: "Levar o agente Conversa de 'funcional' para 'soa natural e elegante'"
- §6 Restrição não-negociável: "Manter estrutura PACER/Crisp do v2"

---

## Anatomia selecionada

```yaml
anatomia_selecionada:
  nome: "PACER"
  versao: "1.0"
  tipo_de_objetivo: "agente conversacional consultivo (Tipo 4) com escalonamento humano + persona forte + restrições explícitas"
  fonte_biblioteca: "data/biblioteca-anatomias.md#anatomia-1-pacer"
  sobreposicao: "Pilar Formato do FAFAC v1.0 sobreposto ao bloco R (Restrictions) — saída estruturada condicional (tags inline + separador <break>)"
  secoes_obrigatorias:
    - "P — Persona (manter v2: agente Conversa do Studio Tirra, calor humano via qualidade)"
    - "A — Action (manter v2 + delta R1/R3: calor via qualidade do profissional, não via preço)"
    - "C — Context (manter v2: injeção dinâmica PERFIL DO CLIENTE + HISTÓRICO + slots Trinks)"
    - "E — Examples (estender v2: few-shot novos cobrindo R1, R2, R3, R4 + NR3)"
    - "R — Restrictions (estender v2: novas regras R1+R2+R3 sobre preço comparativo; regra R4 sobre <break>; preservar tags inline)"
  exige_few_shot: true
  justificativa: |
    PACER cobre exatamente o tipo de objetivo declarado (persona forte +
    escalonamento + restrições explícitas). FAFAC seria match parcial (forte
    em Formato, fraco em Persona). Restrição não-negociável do briefing §6
    ("manter PACER/Crisp do v2") torna a decisão determinística — trocar de
    anatomia = reescrita do zero, fora do escopo de refactor. Sobreposição do
    pilar Formato do FAFAC ao bloco R do PACER permite tratar tags inline e
    separador <break> como cidadãos de 1ª ordem sem mudar a anatomia base.
    Convivência funcional já comprovada em produção (Biblioteca §3 + exemplo
    docs/knowledge-base/sdr-prompt-v2-tess-ready.md).
```

---

## Alternativas consideradas

| Anatomia | Match | Por que não recomendada |
|----------|-------|-------------------------|
| **FAFAC v1.0** | Parcial | Cobre Formato como 1ª ordem (útil pras tags inline + `<break>`), mas o centro do refactor é tom/persona/escalonamento — não saída estruturada. Persona em FAFAC é condensada em "Função", perdendo visibilidade do bloco P que o v2 já estabelece. Mais: trocar de PACER pra FAFAC violaria restrição não-negociável do briefing §6. |
| **Catalogar anatomia nova (CAI / ReAct / outra)** | Não-aplicável | Briefing é refactor de prompt em produção, não criação. Mudança de anatomia = reescrita do zero. Sem evidência catalogada de superioridade pra este tipo de objetivo. **Princípio anti-fossilização respeitado:** PACER recomendado por análise, não por inércia — análise mostra que é o match correto. |

---

## Pilar Formato (FAFAC) sobreposto — operacionalização

Como o pilar Formato do FAFAC é sobreposto ao bloco R do PACER, o @prompt-writer deve tratar como regras de 1ª ordem na seção Restrictions:

1. **Tags inline `<reservar>`, `<cancelar>`, `<remarcar>` etc.** — sintaxe imutável; nunca quebrar entre bolhas (delegado ao splitter backend A3).
2. **Separador `<break>`** — sintaxe nova introduzida no v3; inserido em pontos de quebra natural de respostas conversacionais; backend faz `split()` e envia bolhas separadas com typing indicator.
3. **Bloco único (sem `<break>`)** para: confirmação estruturada de reserva, saudações curtas (uma linha).
4. **Regra de não-quebra de tag:** `<break>` NUNCA pode aparecer dentro de um par `<tag>...</tag>`.

---

## Handoff

**Fontes já curadas no briefing §7** (4 primárias + 2 secundárias, todas rastreáveis). Não há necessidade de devolver pro @prompt-briefer para `*curar-fontes` — etapa 3 já está coberta.

**Próximo comando:**

```
@prompt-writer
*redigir-prompt — inputs:
  - docs/prompts/briefings/conversa-v3-brief.md
  - docs/prompts/briefings/conversa-v3-anatomia.md
  - docs/prompts/tess-conversa-v2.md (base a refatorar)
```

Output esperado da etapa 4: [docs/prompts/tess-conversa-v3.md](../tess-conversa-v3.md)

---

## Validação contra o checklist do agente

- [x] Recomendação tem justificativa explícita de match com o tipo de objetivo
- [x] Alternativas consideradas listadas (FAFAC + catalogar nova)
- [x] Anatomia recomendada existe na Biblioteca (PACER v1.0, §1; sobreposição Formato do FAFAC v1.0, §2)
- [x] Princípio anti-fossilização respeitado (PACER recomendado por análise + restrição não-negociável do briefing, não por default)

---

*Seleção registrada por @prompt-methodology-curator (Tier 2 — prompt-engineering-squad v0.1.0) seguindo `tasks/selecionar-anatomia.md` e `data/biblioteca-anatomias.md`.*

<promise>COMPLETE</promise>
