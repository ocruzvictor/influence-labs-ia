# Task: extract-week-corpus

task: extract-week-corpus
responsavel: "@corpus-miner"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - window_from (ISO date BRT, default: segunda 00:00 da semana corrente)
  - window_to (ISO datetime BRT, default: agora)
  - output_path (default: docs/analysis/floor-corpus-{YYYYMMDD}.md)
  - dedup (default: true — last4 + texto normalizado)
Saida: |
  - corpus_artifact: markdown/JSON com last4, role, agent, intent, text, created_at
  - corpus_stats: { threads_last4, unique_utterances, tess_replied, inbound_only, intent_null_count }
Checklist:
  - "[ ] Janela documentada no header do artefato"
  - "[ ] Zero E.164 no arquivo de saída"
  - "[ ] Colunas: last4, role, agent, intent, text, created_at"
  - "[ ] Stats no footer (fios, falas únicas, intent null)"
  - "[ ] Inventário staff outbound (last_staff_outbound_at = 0 se aplicável)"

## Objetivo

Dump empírico de `conversation_history` para Onda 1 léxico. CLI first; SQL direto só se script não existir.

## Workflow

1. Calcular janela BRT (`window_from` → `window_to`). Documentar no header.
2. Preferir CLI existente:
   ```bash
   # LibForge / scripts/salao — adaptar quando Dex publicar
   node scripts/salao/floor-corpus-dump.js --from "$FROM" --to "$TO" --last4-only
   ```
3. Fallback SQL (VPS read-only, E.164 **só** na query, nunca no output):
   ```sql
   SELECT
     RIGHT(phone, 4) AS last4,
     role,
     agent,
     intent,
     content AS text,
     created_at
   FROM conversation_history
   WHERE created_at >= :window_from AT TIME ZONE 'America/Sao_Paulo'
     AND created_at <  :window_to   AT TIME ZONE 'America/Sao_Paulo'
   ORDER BY phone, created_at;
   ```
4. Se `dedup=true`: colapsar linhas com mesmo last4 + texto normalizado (NFD, lower).
5. Contar stats: fios distintos, falas únicas, fios com assistant, inbound-only, intent IS NULL.
6. Checar `bot_thread_state`: quantos têm `last_staff_outbound_at` na janela — documentar buraco recepção.
7. Escrever artefato em `output_path`. Footer com stats + aviso "sem E.164".

## Veto conditions

- E.164 aparece no artefato → **VETO**, reescrever com last4 only
- Query sem filtro de janela → **VETO**
- Artefato vazio sem explicar (bot off? janela errada?) → **VETO**

## Handoff

→ `@floor-lexicographer` com path + `corpus_stats`
→ Opcional: `@floor-quality` (Mira) para amostra qualitativa de 8 fios

DONE quando artefato existe, stats batem com query de contagem, e zero PII além last4.
