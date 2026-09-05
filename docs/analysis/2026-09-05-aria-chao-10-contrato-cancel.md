# Chão 10 — contrato de cancel (Aria / Orion)

**Data:** 2026-09-05  
**Fecha:** Onda 7 do plano · story `salon-whatsapp-chao-10-recorrencia-trinks.md`  
**SOT anterior:** Dara AC1 + Aria STOP (`2026-09-04-dara-chao-10-recorrencia.md`, `2026-09-04-aria-chao-10-recorrencia-veredito.md`)

> GET detalhe **já correu** (last4 `4830`). `serieId` / campo de série = **0** na lista, no detalhe e no raw. Não repetir PATCH. Sem E.164.

---

## Contrato (Victor 2026-09-05 — alinhado ao dia a dia)

| Fala do cliente | O que a Tess faz |
|---|---|
| Cancela **este** horário / **esta terça** / o agendamento **desta semana** (ocorrência isolada) | **PATCH** no `trinks_id` que já aparece em `AGENDAMENTOS FUTUROS DO CLIENTE`. Uma row. **Sem handoff.** |
| Cancela **todos** os atendimentos recorrentes / **o pacote** / **toda terça pra sempre** / horário fixo da série inteira | **HANDOFF_HUMAN** (motivo existente). **Não** PATCH em loop. **Não** inventar `serieId`. |
| Remarcar **só esta semana** | Fluxo normal `BOOKING_RESCHEDULE` na ocorrência visível. |
| Cliente recorrente na grade | Cada `confirmed` **já ocupa** o slot — **não** aparece como vaga. Sem fatia Dex. |

**O que já funciona hoje:** cancel/remarcar de **uma ocorrência** quando o `bookingId` está no contexto — igual cliente avulso.

**Por que STOP no Dex T3:** a API Trinks **não expõe** `serieId`. Dara provou que PATCH num `id` **pode** (ou não) cascatear no painel quando a recepção cancela “a série”. Sem prova read-only, **não** implementamos cancel em massa. **Não** bloqueia cancel de uma ocorrência.

**Prompt:** não colar «recorrente = HANDOFF» genérico. Handoff só na fala de **pacote / série / todos os próximos**.

**Próximo GO (Victor):** só se quiser código extra de detecção de linguagem “cancela todos” → handoff (prompt + intent). Cancel de uma ocorrência **não precisa GO**.
