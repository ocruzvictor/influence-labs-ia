# Roteiro smoke `0007` — guardado (não rodar agora)

**Status:** congelado 2026-09-04. Uso só depois do [EPIC-tess-chao-unico](../stories/epics/EPIC-tess-chao-unico.md) story 7.  
**Chip:** last4 `0007` (Victor). last4 only.  
**Proibido:** André 10:30 · CREATE `9800` · replay `0101` · OPEN customer-wide.

Primeira passada = conversa, não compromisso. Uma mensagem por vez. Fail imediato se vazar `TA -`, `Validação`, `HABILITACAO` ou ID numérico.

| # | Manda | Esperado | Vertical |
|---|---|---|---|
| 1 | aceita pix? / endereço / horário de funcionamento | FAQ operacional | KB + FAQ |
| 2 | Posso passar aí pra arrumar o pezinho do cabelo? | Acabamento de corte. ≠ pedicure. ≠ Cabelo e Barba | léxico + **memory TESS** |
| 3 | Quero marcar pé e mão | Manicure + pedicure | contraste unha |
| 4 | Quero agendar um corte masculino | Fica no masculino. Não oferecer feminino | gênero sticky |
| 5 | Qual valor para tintura? → Trabalham com gloss? | Família coloração. Gloss ≠ SKU Gloss | léxico |
| 6 | Quem é maquiador aí? | Pode listar nomes. CREATE maquiagem = Fefe | role |
| 7 | A maquiagem não são 2h de atendimento? | Duração 120 min, não 02:00 | duração (já no ar) |
| 8 | (opcional) marcar furo óbvio, outro slot, cancelar | Se recusar “janela 30 min” = story 1, não léxico | slots |

Histórico do piloto 04/09 16:27Z: `0007`-only + `BOT_ACCEPT_ALL=false`. Kill switch voltou off 16:37Z. Religar só no gate da story 7.
