# Estacionados — Orion 2026-09-03 (voltar já)

Victor 2026-09-04 10:28: dor sentida = horário errado + contexto do pedido + fatura. Fatia `docs/analysis/2026-09-04-orion-fatia-slots-contexto.md` (1b, 2b, overlay 9800). Item 7 continua fora do código.

Nada disto é story formal. Sem `@sm`/`@po` não vira AC de epic.

Victor: tokens “promissor demais — salva para voltarmos”. Em seguida: a dor **mais sentida** pelo time de atendimento é slot sugerido que **não cabe** na duração.

---

## PARK-TOKENS — `UNCERTAIN` deixa de herdar FULL + teto por perfil

**Por que estacionar:** corta a fatura de crédito. Victor gostou; pediu para não seguir ainda.

**O que é**

1. `UNCERTAIN` / confiança ≠ `high` **não** monta o dump do salão (~90k chars). Contexto mínimo + **uma** pergunta de desambiguação.
2. Teto de chars/tokens por perfil: passa do limite → corta grade/catálogo, emite evento. Não “manda tudo e reza”.

**O que já está live e não substitui isso:** `scoped` + skip trivial. Ainda explode em `UNCERTAIN` e confiança baixa (`tess-context-profiles.js`).

**Dossiês:** Pedro PV-P0-2 / PV-P0-3; LibForge §6 “P-BUDGET hard cap = Architect após Pedro”; cruzamento G-P1.

**Próximo rito (quando voltar):** `@architect` → `@qa` → ACK Victor. Não paste de prompt. Não split do 46589.

---

## PARK-SLOTS — oferta de horário que não cabe na duração (ping-pong)

**Por que estacionar:** o time que acompanha a Tess sente **mais** isto do que crédito. Cliente escolhe um horário que a Tess sugeriu; na confirmação uma regra recusa; vai e volta até acertar.

**Os dossiês cobrem?** Sim, mas com outro nome. Não é “CRM” nem “crédito”. É **I3 + A5 parciais**.

| Artefato | O que já estava escrito |
|---|---|
| Pedro I3 | Relógio falado = início real + **duração contínua**. Caso `5718` (falou 15:30, gravou 15:00). Depende da frescura da snapshot. |
| Pedro PV-P2-2 | SLO de frescura (slot **ocupado** / stale). Vizinho, não o mesmo bug. |
| LibForge OP001 / OP012 | Grade real do snapshot; snapshot velho → Tess oferece slot que já não existe. |
| Dex 2026-09-02 | **A5/I3 parcial:** guards disparam (`janela continua 30min < duracao 60min`, `inicio nao esta na grade livre`). A **grade rejeita**; a Tess **ainda propõe** o horário inválido **antes** do guard. Caso `4749`. |
| Intake R-003 / D-008 / corpus `00002896` | Regra de negócio: não sugerir horário que não comporte a duração. D-008: a regra está no prompt e **não dispara**. |
| Quinn SCOPE-01 (gate desta fatia) | Diff local do assembler (`durationMin`) ficou **fora** do publish de propósito — muda oferta visível. |

**Mecanismo (não é o prompt “esquecendo” sozinho)**

1. Snapshot tem átomos de ~30 min. Dois átomos livres **não** são uma janela de 60.
2. Live (`b42bb2b`) o assembler chama `compactBookingSlotsBlock` **sem** `durationMin`. O filtro `startsFittingDuration` existe em `tess-context-slots.js` e **não é ligado**. Tess vê 14:00 “livre” mesmo quando só há 30 min contínuos.
3. Prompt já manda: só oferecer se `duracaoMinutos ≤ (NNmin contínuos)`. O modelo ignora com frequência (D-008).
4. Cliente confirma. Guard (`bookingFitsSlotWindow`) recusa. Copy honesta. Novo round. É o ping-pong do time.

**O que já tem dentes (não afrouxar):** I1/I2 + guard na confirmação. Sem o guard, gravaria horário que não cabe. O problema é **cedo demais na conversa**, não a falta de recusa no commit.

**Corte com dentes (código local, não publicado)**

```diff
+ durationMin: resolveOfferDurationMin(svcPayload.data),
```

em `tess-context-assembler.js`. Com duração conhecida, a Tess **não vê** inícios que não cabem; se ninguém couber, a linha é “sem janela contínua de Xmin neste dia”.

**Limites desse corte (não inventar que resolve tudo)**

- `resolveOfferDurationMin` devolve `0` se não há SKU, ou se há **mais de 3** serviços no payload → sem filtro (mesmo comportamento live).
- Sem profissional conhecido o bloco compacto ainda fala ocupação manhã/tarde, não relógios — Tess pode **inventar** hora a partir disso; o guard pega depois.
- Slot **stale** (I3 / OP012): o buraco cabia quando o snapshot foi puxado e já foi preenchido. Outro ofensor; filtro de duração não fecha.

**Relação com PARK-TOKENS:** vizinhos, não o mesmo corte. FULL/UNCERTAIN aumenta a chance de a Tess **ver** grade demais e alucinar hora. Filtrar por duração **reduz** oferta inválida mesmo em `scoped`. Não substitui o teto de chars.

**Próximo rito (quando voltar):** Architect + QA no wiring `durationMin` (já escrito, já testado em `tess-context-slots.test.js`). Medir: taxa `guard.blocked` com reason `janela continua` / `inicio nao esta na grade livre` **antes vs depois**. Sem mudar prompt 46589 como “fix”. Sem replay do slot André 10:30.

---

## Pool — o que os dossiês cobriram e **não** entrou no publish `b42bb2b`

Só leftover. O que já está no ar (outbox, SLA Tiago 15 min, `scoped`, intent + bytes, CLIs, skip trivial) não se repete aqui.

### Time do salão sente

| # | Assunto | O que é, sem jargão | Dossiê |
|---|---|---|---|
| 1 | Horário que não cabe | Tess sugere hora; na confirmação a regra recusa; vai e volta. Filtro por duração já escrito, **não publicado**. | I3/A5, PARK-SLOTS |
| 2 | Horário que já foi embora | Snapshot velho: ofereceu vaga que alguém pegou no meio. | I3, PV-P2-2, OP012 |
| 3 | Enxergar o fio | Não é funil. É lista “quem está esperando o quê” derivada de 2xx/eventos. SLA do Tiago existe; a **visão** do time não. | H-CRM lite, G-P12 |
| 4 | Handoff que some | Aceite + SLA no ar. Re-alerta ainda é evento/CLI — não um “chacoalhão” no WhatsApp do Tiago. Sem aceite o fio volta à IA por relógio. | PV-P0-5 resto |
| 5 | Tess contradiz o watchdog | Copy honesta do outbox **não** entra no histórico. Próximo turno ela pode falar outra coisa. | OBX-03 |

### Fatura / timeout Tess

| # | Assunto | O que é, sem jargão | Dossiê |
|---|---|---|---|
| 6 | `UNCERTAIN` = caminhão | Não entendeu → manda o salão inteiro (~90k). Uma pergunta barata. | PV-P0-3, PARK-TOKENS |
| 7 | Sem teto de tamanho | Passou do limite, ainda assim envia. Único freio = 25s. | PV-P0-2 |
| 8 | Crédito só no dia | Dá para ver chars do turno; **não** cruza crédito × intent. “Cortamos X%” ainda é achismo. | PV-P1-2, G-P6 |
| 9 | Timeout único | Lean e FULL usam os mesmos 25s. | PV-P1-5 |
| 10 | Skip FAQ / preço / “amanhã tem?” | CLI mede; a **fala** ainda é Tess. Ligar skip no inbound = veto de processo. | OP013/014/001 |

### Quem patrulha / opera

| # | Assunto | O que é, sem jargão | Dossiê |
|---|---|---|---|
| 11 | Alarme stuck mentiroso | CLI já filtra. Nightwatch **live** ainda conta fio silenciado/bloqueado como travado (`LIMIT 20`). | PV-P1-1, G-P7/G-P8 |
| 12 | Alerta que não “queima” | Patrulha é puxada à mão. Sem taxa (timeout/failed/handoff por hora). | PV-P1-6 |
| 13 | Fio some em 30 min | Sem `trace_id`, prova I1 é last4 ± meia hora. | PV-P2-1, G-P13 |
| 14 | Smoke `0007` + sintéticos | História 13 sem smoke humano. Replay André **proibido**. | PV-P2-4 |

### Risco silencioso (cliente não vê na hora)

| # | Assunto | O que é, sem jargão | Dossiê |
|---|---|---|---|
| 15 | CREATE some no restart | Chave de “já marquei” mora na memória do container. | PV-P1-4 |
| 16 | `confidence` / perfil do turno | Gravamos intent + bytes. Não gravamos se foi FULL ou o quão certo o classificador estava. | PV-P0-1 resto |
| 17 | ~300 arquivos locais | Não são release. Rito de fatia ainda frouxo. | PV-P2-3 |
| 18 | Quinn de papel | Gate CONCERNS. Bloqueadores de publish tratados na operação; veredito não reaberto. | gate 72 |
| 19 | Nginx / assembler local | De propósito fora. Assembler = o `durationMin` do item 1. | SCOPE-01/02 |

### De propósito **não** fazer (os dossiês pedem para não perseguir)

| # | Assunto | Por quê |
|---|---|---|
| 20 | Partir o agente 46589 | Causa é o assembler, não o número de agentes. |
| 21 | Funil CRM / nota escrita pela Tess | Checkpoint sem dentes. |
| 22 | Desligar Thinking | Nunca esteve ligado neste 46589. |
| 23 | Replay `0101` / 10:30 André / last4 de “não retomar” | Trava explícita. |
