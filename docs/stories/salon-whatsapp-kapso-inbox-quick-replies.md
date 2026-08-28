# Story: Inbox Kapso — busca por texto + quick replies (Gabriel/Tiago)

**Tipo:** Brownfield ops (UX humana no Inbox)
**Status:** Ready for Review
**Agente executor:** Victor (configura painel) · Gabriel/Tiago (usam) · @sm (checklist)
**Story Points:** 1
**Branch:** `feature/bot-46589-ajustes-resposta`
**Pedido:** Victor / @aios-master 28/08/2026 — item 2. Sem Findings. Sem crédito de AI Kapso.

## Contexto

Pesquisa §2.4: a inbox passou a buscar **texto da mensagem**, nome e telefone (antes só telefone). Quick replies (`/atalho`) e atalhos de teclado (J/K/Enter/R) são para o humano que assume o thread.

O TESS 46589 **não lê** `/preco` `/endereco` `/horario`. Isso não altera o prompt nem a KB. É cola da recepção quando o bot silencia e o Inbox assume.

“Generate in composer” da Kapso **consome crédito de AI** — fora desta story.

Conteúdo dos atalhos deve copiar a KB já publicada do Studio Tirrá (`data/client/kb/` / Tess memories), **não** inventar preço ou horário.

## Escopo

**IN:** 3–5 quick replies no Inbox do número **bot** `+55 11 97504-0517`; checklist de uso (busca por texto + atalhos); treino Gabriel/Tiago.

**OUT:** Findings, generate-in-composer, Kapso Agent, `BOT_ACCEPT_ALL`, qualquer mudança no `94831`, código backend/admin, n8n.

## Acceptance Criteria

- [x] **AC1:** Checklist em `docs/ops/kapso-inbox-quick-replies-gabriel.md`: como buscar uma frase do cliente; como disparar um atalho; quando **não** usar (thread ainda no bot / não assumir o `94831`).
- [ ] **AC2:** No Inbox Kapso do `97504-0517` existem pelo menos 3 quick replies. Nomes sugeridos (ajustar ao texto real da KB): `/horario`, `/endereco`, `/preco`. Opcional: `/estacionamento` ou `/cancelar` se o texto já existir na KB.
- [x] **AC3:** Cada atalho cola texto **fiel** à KB vigente (não inventar valor). Review de uma linha no checklist: fonte (arquivo KB ou memória Tess).
- [ ] **AC4:** Gabriel (ou Tiago) confirma no checklist que achou uma conversa **por texto** (não só por telefone) numa sessão de treino. Sem abrir whitelist.

## File List

- `docs/stories/salon-whatsapp-kapso-inbox-quick-replies.md` (M)
- `docs/ops/kapso-inbox-quick-replies-gabriel.md` (A)

## Dev Agent Record

- Draft @aios-master 28/08/2026. Zero deploy.
- @dev 28/08/2026: checklist criado com textos fielmente copiados de `data/client/kb/faq.md` (`/horario`, `/endereco`, `/preco`, opcional `/cancelar`). `/estacionamento` omitido (PENDENTE em salon-info.md). Seção **Victor faz no painel** com paste exato para AC2 e AC4 — pendente execução humana no Kapso.

## Change Log

- 2026-08-28 — @aios-master: story draft. Só UI humana Kapso.
- 2026-08-28 — @dev: AC1 + AC3 implementados; AC2 + AC4 bloqueados (painel/treino Victor/Gabriel/Tiago). Status → Ready for Review (parcial).
