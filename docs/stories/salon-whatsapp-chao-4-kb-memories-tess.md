# Story 4: Memories TESS 39496 alinhadas ao chão (não só o markdown local)

**Epic:** [EPIC-tess-chao-unico](epics/EPIC-tess-chao-unico.md)  
**Tipo:** Brownfield  
**Status:** Draft  
**Executor:** @dev (diff KB) · sync ops com ACK Victor  
**Quality gate:** @qa + Victor (PATCH memories)  
**Story points:** 5  
**Fonte:** Etapa 11 · collection 39496 · prompt v3.2.3 · hipótese KB=impressão

## Story

**As a** Tess no `execute`,  
**I want** as memories que o RAG puxa a dizer a mesma coisa que o prompt v3.2.3,  
**so that** “pezinho” não volte a virar pedicure porque o dicionário de 02/09 ganhou do system prompt.

## Contexto

Seis memories no ar (163141–163147, sem 163143). Sync 02/09. O prompt novo já tem exceção pezinho e proíbe falar `TA -`. A memory `sinonimos` / `regras` / `faq` / `fichas` ainda ensina pé=pedicure e o SKU interno.

O backend não injeta esses arquivos. Quem atrapalha é a **memory anexada na TESS**.

## IN

- Diff mínimo em `data/kb/conversa-v2/`: pezinho ≠ pé; “pé e mão” continua unha; não citar `TA -` como nome falável (faq + fichas).
- PATCH collection 39496 pelo script `sync-kb-content-to-tess.cjs` **só com ACK Victor**.
- Snapshot pré-sync (mesmo rito Etapa 11).
- Laser continua sem memory.

## OUT

- Reescrever visagismo/mechas/laser. Nova memory. Colar prompt de novo. Smoke `0007`.

## Acceptance Criteria

- [x] **AC1:** Diff local: pezinho explícito; `TA -` não é fala.
- [x] **AC2:** File list + snapshot pré-sync.
- [ ] **AC3:** ACK Victor → PATCH 6 memories; checagem: pezinho presente, `TA -` como fala ausente nas memories puxadas.
- [ ] **AC4:** Sem OPEN, sem WhatsApp, sem Hostinger.

## Tasks

- [x] T1: diff KB  
- [x] T2: Quinn no diff  
- [ ] T3: Victor ACK + sync  

## File List

- `data/kb/conversa-v2/sinonimos-servicos.md` — pezinho ≠ pedicure; regra explícita + linha tabela
- `data/kb/conversa-v2/regras-comerciais.md` — exceção pezinho ao lado de "fazer pé"
- `data/kb/conversa-v2/faq-servicos.md` — Corte Masculino falável; sem `TA -` ao cliente
- `data/kb/conversa-v2/fichas-tecnicas-servicos.md` — prefixo `TA -` só ops; não nome de boca
- `docs/intake/kb-proposta-v1/archive-live-pre-chao4-2026-09-04/` — snapshot pré-edit (HEAD) dos 4 arquivos
- `docs/intake/kb-proposta-v1/archive-et11-uncommitted-2026-09-04/` — park do rewrite visagismo/mechas/laser que estava sujo no tree (não é esta story)

## Dev Agent Record

- **Sync TESS:** NÃO executado (AC3 aguarda ACK Victor)
- **Implementação:** diff local alinhado ao prompt v3.2.3 (pezinho, TA -)

## QA Results

### Review Date: 2026-09-04

### Reviewed By: Quinn (Test Architect)

### Reviewed Revision: wt-digest:c2eb2acaa50b (base 7482d3d, worktree dirty; re-gate pós-isolamento)

### Code Quality Assessment

IN local isolado: pezinho ≠ pedicure ≠ Cabelo e Barba; "fazer pé"/"pé e mão" ainda unha; `TA -` só nota interna. Snapshot `archive-live-pre-chao4-2026-09-04/` continua HEAD pré-edit (cksum idêntico; live diverge). `git diff --stat data/kb/conversa-v2/` = 4 files (+12/−6). padroes-fala / info-estatica / laser = HEAD. Visagismo 900 / mechas 880 só no park `archive-et11-uncommitted-2026-09-04/` (não TESS sync). REQ-01 fechado.

### Refactoring Performed

Nenhum. Anti-self-review: Dex/Orion escreveram o KB; Quinn não patchou markdown.

### Compliance Check

- Coding Standards: ✓ markdown KB; sem backend nesta File List
- Project Structure: ✓ snapshot no rito Etapa 11; park et11 fora do live
- Testing Strategy: ✓ N/A (story markdown; sem unit exigido)
- All ACs Met: AC1/AC2 locais ok; AC3 aberto (39496 OLD); AC4 respeitado neste gate

### Improvements Checklist

- [x] Orion isolou o slice (só pezinho + TA nos 4 allowlist)
- [ ] Não PATCH 39496 sem ACK Victor
- [ ] AC3/T3 só depois de Victor dizer sync

### Security Review

Sem OPEN, sem Hostinger, sem script de sync neste gate. Scripts `sync-kb-content-to-tess.*` mtime 2026-09-02.

### Performance Considerations

Markdown only. Sem assembler/slot/crédito atribuído a esta story.

### Files Modified During Review

- `docs/qa/gates/2026-09-04-chao-4-kb.yml` (re-gate PASS)
- `docs/handoffs/2026-09-04-quinn-gate-chao-4.md` (re-gate)
- esta story — QA Results + T2

### Gate Status

Gate: PASS → docs/qa/gates/2026-09-04-chao-4-kb.yml

Prior: CONCERNS (REQ-01 ride-along) → resolvido no isolamento.

**Memories 39496 ainda OLD até Victor dizer sync.** Este gate não autoriza TESS PATCH, OPEN, smoke 0007, Hostinger.

### Lifecycle Transition

Não aplicada. Status permanece **Draft** (não InReview; AC3/T3 abertos). T2 marcado: PASS com `blocks_publish` vazio.
