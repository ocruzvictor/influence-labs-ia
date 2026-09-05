# Chão 10 — contrato de cancel (Aria / Orion)

**Data:** 2026-09-05  
**Fecha:** Onda 7 do plano · story `salon-whatsapp-chao-10-recorrencia-trinks.md`  
**SOT anterior:** Dara AC1 + Aria STOP (`2026-09-04-dara-chao-10-recorrencia.md`, `2026-09-04-aria-chao-10-recorrencia-veredito.md`)

> GET detalhe **já correu** (last4 `4830`). `serieId` / campo de série = **0** na lista, no detalhe e no raw. Não repetir PATCH. Sem E.164.

---

## Contrato (não é GO de Dex)

| Fala do cliente | O que a Tess faz |
|---|---|
| Cancela **este** horário (id que ela já vê na lista do cliente) | Igual hoje: PATCH no `trinks_id` da ocorrência. Uma row. |
| Cancela **o horário fixo / toda terça / a série** | **HANDOFF_HUMAN** (motivo existente, ex. `dado_indisponivel`). **Não** PATCH em loop. **Não** inventar `serieId`. |
| Recorrente só na ocupação da grade | Já OK — cada `confirmed` isolado já some da oferta. Sem fatia. |

**Dex T3:** continua **STOP**. Não há prova de que PATCH numa ocorrência **não** cascateia no painel. Sem essa prova, cancelar série no escuro é o risco da story.

**Prompt:** não colar «recorrente = HANDOFF» como regra geral (colide com cliente habitual). Só a fala de **série / horário fixo**.

**Próximo GO (Victor):** só se Trinks documentar escopo do PATCH ou se aceitarmos HANDOFF forever para série (sem código de cancel em massa).
