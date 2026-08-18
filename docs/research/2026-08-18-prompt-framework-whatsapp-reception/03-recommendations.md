# Recomendações

Não implementar nesta pesquisa. Ordem sugerida para @pm / @dev / Victor no TESS.

## O que não fazer

1. Não reescrever o 46589 do zero “estilo Flora 7k” nem “estilo 200 tokens”.
2. Não migrar TESS→Gemini só para copiar o Eco Adventure. Lá a migração era provider + eval barato; aqui o gargalo é **borda + snapshot + harness**.
3. Não enxugar o prompt antes de ter o golden set do Gabriel no eval — senão não dá para saber se melhorou.

## O que fazer (fatia verificável)

### A. Harness (primeiro — senão qualquer framework é opinião)

1. Atualizar `scripts/test-conversa-v3.mjs` (ou sucessor) para o contrato **real**: `HORARIOS VAGOS` texto, preços 17/08, I.10 sem `<break>`.
2. Gate binário nas kill-rules K1–K8 de `docs/analysis/gabriel-smoke-aderencia-2026-08-18.md`.
3. Fixtures: 14 turnos Gabriel + Dylan + “e com o Tiago?” + combo que estoura 19h.
4. Critério de PASS = zero K + qualitativo ≥ 75% (mesmo desenho Flora 9.3).

Owner: @qa desenha; @dev liga no script. Sem isso, troca de framework não é mensurável.

### B. Context engineering (maior alavanca de “tamanho”)

1. Não injetar 119 serviços por turno. Filtrar por intenção (profissional citado, família do serviço, dia pedido).
2. Slots: só o profissional + dia em jogo, não 10 dias × 13 pessoas.
3. Histórico: 6–8 turns ou resumo; o LIMIT 15 + duplicata `passive` é haystack.
4. KB TESS: só o arquivo pertinente (sinônimos no termo coloquial; fichas só no combo).

Owner: @architect decide o filtro; @dev implementa. Prompt quase não muda.

### C. Constituição (prompt, pequeno)

Os 3 patches + trip-wire já escritos na análise Atlas (I.11 expediente, I.12 não recriar, vocabulário/WhatsApp, ROLE sem “premium”). Isso **aumenta** um pouco o prompt e **aumenta** densidade — alinhado ao Anthropic (“minimal ≠ short”).

Owner: Victor cola no TESS depois do harness baseline.

### D. Guardas de código (já diagnosticadas)

- Idempotência `BOOKING_CREATE`
- Recusa create que estoura fechamento
- “Te esperamos” só se `isSalonOpen` do **dia agendado**

Owner: @dev. Sem isso o harness K2/K1/Q6 continua vermelho mesmo com prompt perfeito.

## Decisão de produto ainda aberta

Dois profissionais no mesmo start (Erick ∥ Jackie): não está nos artefatos. Escolher 1–4 da análise Atlas **antes** de gravar no prompt. Harness inclui um cenário para a opção escolhida.

## Next steps

- @pm: priorizar A → D vs outras stories do 46589.
- @dev: harness + filtro de snapshot + idempotência.
- Victor: não colar um “framework novo” até existir score no golden Gabriel.
- @architect: só se a opção for tool-calling (buscar serviço/slot sob demanda) em vez de snapshot filtrado — é o “just in time” da Anthropic; custa mais latência.
