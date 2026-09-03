# Handoff → sessão madrugada [Audit error investigation](3dceb1a7-f9d4-4149-9731-dd341cc58bba)

**De:** Orion (@aiox-master) sessão Hostinger + smoke `0007`  
**Para:** a mesma sessão da madrugada (epic `tess-commit-honesty`) — **planejar correção**, sem rsync nesta wave  
**Quando:** 2026-09-03 ~10:12 BRT  
**VPS:** honesty `6b4fa07` ainda no ar. Bot **GLOBAL OFF** (`bot_toggles.global=false` → `server.js` ~2557 silêncio). `BOT_ACCEPT_ALL=true` (OPEN) não manda enquanto o kill switch estiver off.  
**last4 only.** Chip smoke: `0007` (Victor). Sem PII.

Cola isto na sessão `3dceb1a7-f9d4-4149-9731-dd341cc58bba` e peça @pm/@architect plano P0/P1. **Não** é Hostinger. **Não** é crédito (ato 2).

---

## O que o smoke PROVOU (não refazer)

| Caso | Resultado |
|---|---|
| I1 armadilha Fefe 9h + “já confirmou?” | **PASS** — “Não confirmei nada às 09h.” |
| 2-phase “Tá certo?” antes do Ok | **PASS** (manhã 08:15 e ato 2 09:57) |
| CREATE 1 SKU André 10:30 (primeira vez, 08:15) | **PASS** — POST `/agendamentos` **201**, `trinksId=526039154` |
| `tess.empty` credits=0 → `handoff.human` | **PASS** (09:23, crédito Tess; P0.7 no ar) |
| TipoId cliente novo | **não exercitado** — `0007` já é cliente. Não replay `0101`. |

Cancelamos `526039154` às 09:30 via PATCH `agent_mutation_cancel` **204** (ops, não WhatsApp).

---

## Bugs novos para o plano (P0 / P1)

### B1 — Idempotency trata cancelado como duplicata + boca confirma (I1)

**Evidência:** 09:58 BRT `0007`. Tag CREATE correta (`serviceId=14232906`, André `827200`, `2026-09-03` 10:30). Log: `[idempotency] create duplicado ignorado e799e336…`. **0** `booking.created`, **0** POST. Tess: “Confirmo aqui o agendamento então”. Snapshot: só `526039154` `cancelled`.

**Causa real (código lido 10:12):** `findDuplicateAppointment` **já ignora** `cancelled` (`ACTIVE_STATUSES` só `scheduled`/`confirmed` em `booking-guards.js`). O skip veio do **Set em memória** `state.createKeys` (`server.js` ~1779–1783): o CREATE 08:15 gravou a mesma `idemKey`; o cancel ops 09:30 limpou a Trinks/local, **não** o Set da sessão. Mesmo slot de novo → `continue` com `createIdempotentSkip` **sem** `finalMessages` e **sem** barrar a copy 2-phase “Confirmo aqui”.

**Correção:** ao cancelar (WhatsApp ou ops), dropar a `idemKey` da sessão **ou** não tratar `createKeys` como verdade se o snapshot ativo não tem o slot. Se skip: não afirmar sucesso. Unit: CREATE → cancel → mesmo slot na mesma sessão → POST de novo (ou recusa honesta), nunca “Confirmo aqui” sem 2xx.

### B2 — Cancel tag usa SKU como `agendamento_id` (I1 cancel)

**Evidência:** 09:59 `cancel.not_owned` `requestedId=14232906` (SKU Corte, **não** booking). `booking.cancelled` `outcome=none`. Log: `Cancel not_owned: bookingId=14232906`. Tess: “Não consegui localizar/cancelar… recepção”. Intent do turno = **FAQ** (grade 0).

**Causa candidata:** parser/tag `cancels[]` preencheu id do serviço; `isBookingOwnedByClient` recusa. `future_bookings` vazio (create pulou) → resolveu mal.

**Correção:** cancel só com `trinks_id` de `AGENDAMENTOS FUTUROS` / snapshot ativo. SKU ≠ bookingId. Se não resolver: recusa honesta (já tem copy). Unit: tag `{agendamento_id: 14232906}` + futuro 526039154 → 0 PATCH no SKU.

### B3 — “Esquece” + pedido novo na mesma frase → FAQ / handoff (I2)

**Evidência:** 09:49 “Esquece isso então. Agora só um corte… André…”. `classifyTessIntent` → **FAQ** `abort_draft` (`tess-context-intent.js` ~246–247). `horarios=0`. Tess “deixa eu verificar” + `HANDOFF_HUMAN dado_indisponivel` + silêncio 6h. User “to esperando” = `human-handled`.

**Correção:** se `hasAbortDismissSignal` **e** há sinal de booking novo na mesma mensagem → **SCHEDULING**, não abort FAQ. Não handoff `dado_indisponivel` só porque o profile FAQ zerou a grade. Unit: texto do smoke 09:48 → intent SCHEDULING.

### B4 — “Pode cancelar esse que a gente acabou de marcar” classificado FAQ

**Evidência:** 09:59 intent FAQ, `future_bookings=0` (B1). Tag cancel mesmo assim saiu (B2). Secundário a B1+B2.

---

## Fora de escopo deste handoff

- Hostinger CPU / steal / limite 20% (outra sessão; freio já pedido).
- Religar Chatwoot/n8n.
- Colar prompt / rsync.
- Replay `0101`. Combo mão+pé (desvio do roteiro, não P0 novo).

## Estado ops ao fechar (10:12 BRT)

- `bot_toggles.global=false` (silêncio total — inbound Kapso retorna `{ok:true}` sem Tess).
- Whitelist `allow` restaurada: `0007` `0330` `0447` `2495` `2987` `4905` `8027` `8285` `9295` (8 pausas smoke revertidas + `0007`).
- `human_only` de drill-down **não** tocado (`0072` `2513` `5375` `5958` `7584` `8134` `8383`). `5131` continua `block`.
- `BOT_ACCEPT_ALL=true` (OPEN de novo; irrelevante enquanto global=false).
- `0007` `silenced_until=NULL`.

## Pedido à sessão da madrugada

1. Abrir este arquivo.  
2. Stories/patches B1–B3 (B4 se sobrar).  
3. Quinn: unit dos três; live só whitelist nova / `0007` com **outro** slot, não 10:30 03/09.  
4. Deploy **não** é DoD até gate.

## Resultado da wave de código (2026-09-03)

- B1–B4 implementados no branch `feature/tess-commit-honesty`; cancelamento parcial também recebeu outbound honesto.
- Gates finais: focused **144/144**, backend **502/502**, prompts **79/79**, lint/typecheck/sintaxe/whitespace **PASS**.
- CodeRabbit CLI 0.6.1: `doctor` **9/9 PASS**; review final do backend **0 findings**. O repositório ainda não está conectado a uma organização CodeRabbit, então foi usada a franquia CLI gratuita.
- Nenhum deploy, rsync, Hostinger, POST/PATCH Trinks real, replay `0101` ou exercício 03/09 10:30 André foi executado. O live continua no código anterior até publicação autorizada.
