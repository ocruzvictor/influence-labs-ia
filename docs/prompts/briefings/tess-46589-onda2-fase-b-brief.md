# Briefing de Prompt — Tess 46589 Onda 2 Fase B

**Versão do template:** `v0.1.0`  
**Owner:** `prompt-briefer` (etapa 1) — rascunho Orion 2026-09-04; solicitante Victor  
**Consumidores:** `prompt-methodology-curator` (etapa 2), `prompt-writer` (etapa 4)  
**Cola 46589:** **proibida** até gate Victor no diff da versão nova.

---

## 1. Identificação

- **id_prompt:** `tess-conversa-46589-onda2-fase-b`
- **escopo/cliente:** `studio-tirra`
- **solicitante:** Victor (produto) · Orion (orquestração)
- **data_briefing:** `2026-09-04`
- **destino do prompt:** agente TESS **46589** (WhatsApp Studio Tirra)

---

## 2. Tipo de agente

- **tipo:** `Tipo 4 — autônomo conversacional`

---

## 3. Canal

- **canal_principal:** WhatsApp
- **plataforma:** TESS Studio · Kapso Cloud API (`0517`)
- **modo de injeção:** system prompt fixo (bloco `tess-conversa-v3-clean.md`) + contexto dinâmico por turno (backend scoped)

---

## 4. Objetivo de negócio

- **objetivo:** A Tess **ler** o vocabulário do chão desta semana (pezinho, tintura/gloss, masculino, maquiador) e **não** ecoar scratch interno no WhatsApp.
- **kpi_principal:** zero remap pezinho→pedicure nos fios de amostra Mira; zero leak `TA -` / Validação / HABILITACAO / ID Trinks no outbound; gênero masculino sticky no fio `4749`-class.
- **anti_objetivo:** não inventar SKU de pezinho; não afirmar marca Gloss; não religar o bot; não aumentar FULL; não colar este briefing no TESS.

---

## 5. Persona resumida

- **nome_persona:** Tess
- **papel:** recepção WhatsApp Studio Tirra (agenda / preço / FAQ)
- **tom:** curto, chão, sem jargão interno Trinks
- **público:** clientes do salão no WhatsApp (landing “vim pelo Studio Tirra” incluso)

---

## 6. Restrições conhecidas

- Nunca escrever `TA -`, `[Validação rápida…]`, `Consultando HABILITACAO`, IDs Trinks no WhatsApp
- Nunca tratar pezinho do cabelo como pedicure
- Nunca resetar gênero F/M por omissão no turno seguinte
- Nunca colar o prompt neste briefing nem no chat de orquestração
- Sem split 46589, sem desligar Thinking, sem POST Trinks como teste
- **escalonamento:** snapshot sem SKU (pezinho/contorno, gloss marca) → handoff recepção, não chute

---

## 7. Fontes esperadas

- `docs/handoffs/2026-09-04-mira-amostra-lexico.md` — falhas de linguagem
- `docs/analysis/2026-09-04-aria-onda2-triagem-tetos.md` — o que o código já faz (não duplicar I3)
- `docs/analysis/floor-lexicon-catalog-v0.1.0.md` — seed léxico
- `docs/prompts/tess-conversa-v3-clean.md` — vivo v3.2.1 (**ler no writer; não colar aqui**)
- `docs/prompts/README-46589.md` — rito de cola/rollback

Recepção Kapso desta semana = vazia (ACK Victor: sem export `94831`). Não inventar fala de staff 01–04/09.

---

## 8. Critérios de sucesso (eval)

- Diff da nova versão referencia last4 Mira (`1000` `4501` `4749` `4905` `0330`) sem E.164
- Archive da v3.2.1 no mesmo PR/commit da v nova
- Quinn / evaluator: zero trecho do prompt live neste briefing
- Victor ACK explícito no **diff** antes de colar no TESS

---

## Estado

`current_etapa = etapa_1_briefing`  
Writer **não** autorizado até Victor dizer para redigir o diff.
