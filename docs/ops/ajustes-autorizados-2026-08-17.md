# Ajustes autorizados — bot 46589 (revisão 17/08/2026)

Status: **implementado em código 17/08/2026** (gates: backend 173/173, root lint/typecheck/test 79/79). Prompt TESS ainda precisa cola do Victor. Deploy VPS pendente.  
Branch: `feature/bot-46589-ajustes-resposta` · VPS HEAD `2e12e79`  
Go-live / `BOT_ACCEPT_ALL`: **não**. Recepção humana permanece no `+55 11 94831-9426`.

Consulta feita em 17/08/2026 ~20:35 UTC no snapshot Trinks (não KB estática).

---

## Correções de produto (Victor 17/08) — o que muda no plano anterior

| Item | Plano antigo | Plano revisado |
|---|---|---|
| Dylan | Recusa = PASS | **Meio-passe.** Recusa certa; texto da recusa **FAIL** (inventou cabelo). |
| Corte feminino | “Não comparar Tiago vs equipe” genérico | **Tabela feminina não discrimina Tiago vs equipe.** Só dia normal vs promo. Premium Tiago/equipe vale **só no masculino**. |
| Janela 5 dias | Aceitar e mandar recepção se Tiago lotado | **Alongar alcance sem REST no hot path.** Tiago cheio nos 5 dias → o bot não pode virar handoff crônico. |
| Combo 3 serviços | Handoff na primeira dificuldade | **Tentar montar e concluir.** a recepção só se não der. Smoke extra com outros combos. |

Itens que **permanecem** do plano anterior: bolhas cortadas (`toWhatsappBlocks` + `slice(0,6)`), nunca inventar turno `Cliente:`, nunca `BOOKING_CREATE` sem confirmação real, webhook SNS silencioso pós-mutação, after-hours Kapso 422, takeover P0 #10.

---

## 1. Dylan — recusa certa, contexto errado

### Fonte de verdade (snapshot)

Dylan Scalabrin (`trinks_id` 876098). **13 serviços, todos unha.** Zero corte, zero tratamento capilar:

Alongamento em gel · Banho de gel · Blindagem · Decoração de unha em gel · Esmaltação em gel · Esmaltação - Mãos · Manicure · Manicure e Pedicure · Manutenção de alongamento · Manutenção de unha quebrada · Manutenção no banho de gel · Pedicure · Remoção de esmaltação em gel.

### O que falhou

A regra “não ofertar Dylan para Corte Masculino” passou. A **explicação** (“unhas e alguns tratamentos capilares”) é alucinação. A KB `fichas-tecnicas-servicos.md` nem lista o Dylan; o bot não pode completar o vazio com cabelo.

### Ajuste

1. **Prompt (Victor cola):** na recusa, citar **somente** o que está em `HABILITACAO` / `SERVICOS` para aquele profissional. Dylan = unhas. Proibido “tratamentos capilares”, “alguns serviços de cabelo”, etc.
2. **Código:** `formatIncompatibleProfServiceMessage` hoje só lista quem **faz** o serviço pedido. Completar com uma linha do tipo “O Dylan atende: manicure, pedicure, alongamento…” lida de `listCompatibility` + `listServices` daquele `professionalId`. Sem fallback inventado.
3. **Smoke:** “corte com Dylan” → recusa + lista de unhas, sem cabelo. Depois oferta Erick/André/Tiago habilitados no corte masculino.

---

## 2. Preço — masculino vs feminino (não improvisar)

### O que o Trinks tem agora (snapshot; `valorPromocional` = null em todos)

| SKU | Preço | Duração | Habilitados no snapshot |
|---|---:|---:|---|
| Corte Masculino | R$ 90 | 60 min | **Erick** |
| TA - Corte Masculino | R$ 105 | 60 min | **André, Tiago** |
| Corte Feminino | R$ 190 | 120 min | **Giovanna, Jackie** |
| Tiago - Corte Feminino | R$ 250 | 90 min | **Tiago** |

KB `faq-servicos.md` / `fichas-tecnicas-servicos.md` está **desatualizada** (masculino 85/100, feminino 180/190). O bot leu isso e inventou “equipe R$180 / Tiago premium R$190” no feminino.

O backend **não injeta preço** em `SERVICOS DISPONIVEIS` — só nome, profissionais e ID. Sem preço no contexto dinâmico, o TESS cai na FAQ velha.

### Regra de conversa (produto)

- **Masculino:** sim, discrimina. Equipe (Erick / SKU Corte Masculino) vs tabela TA (Tiago e André). Números oficiais = snapshot (90 vs 105), não a KB.
- **Feminino:** na pergunta genérica (“quanto custa corte feminino?”) **não** contrastar Tiago vs equipe. A discriminação que o cliente ouve é **dia normal vs terça/quarta promo**.
- **Não inventar valor promo:** o campo `valorPromocional` está `null`. Dizer que terça/quarta podem ter condição, sem chutar o número, até a fonte de promo existir no snapshot.

### Ponto a confirmar com Victor (não inventar)

No Trinks **existe** o SKU `Tiago - Corte Feminino` a R$ 250. Isso não entra na resposta genérica. Falta fechar o que dizer se o cliente pergunta **explicitamente** “corte feminino com o Tiago”:

1. Responder R$ 250 (I.4 atual: preço de UM profissional = só o dele), ou
2. Responder o mesmo valor da tabela feminina (R$ 190 / promo), e o booking interno usa o SKU do Tiago.

Até essa resposta, o código **não** volta a oferecer o comparativo equipe vs Tiago no feminino.

### Ajuste

1. Injetar `preco` + `duracaoEmMinutos` em `SERVICOS DISPONIVEIS` a partir do snapshot.
2. Prompt I.4: masculino pode citar 90 vs 105 **só se o cliente pedir comparação ou profissional**; feminino genérico = um valor + promo de dia, sem “premium Tiago”.
3. FAQ/KB `conversa-v2` alinhada ao snapshot (senão o TESS continua lendo 180/190).
4. Jackie habilitada em Corte Feminino no snapshot: **flag de catálogo** (KB dela é unha). Não “corrigir” no prompt; confirmar no Trinks se a dupla está certa.

---

## 3. Janela de agenda — mais alcance, sem estourar REST

### Por que 5 dias quebra o Tiago

Slots **disponíveis agora** no snapshot local:

| Profissional | ~5 dias | Snapshot inteiro (~até 26/08) |
|---|---:|---:|
| Tiago | **3** | **12** |
| André | 49 | 72 |
| Erick | 55 | 94 |
| Dylan | 105 | 148 |

O worker já grava **7 dias úteis** (`TRINKS_SLOT_SNAPSHOT_DAYS` default 7 → 18 a 26/08). O `processMessage` só **injeta 5** (18–22/08). Os furos do Tiago em 25–26 já estão no Postgres e o TESS não vê.

`extractRequestedDate` só entende `DD/MM` ou ISO. “25 de agosto de 2026” **não dispara** `ensureSlotSnapshot`. Por isso o bot disse “janela até 22/08 / a recepção anota” mesmo com terça 25/08 já no banco.

Custo: FAQ/slots no hot path = **0 REST** (webhook-first). Snapshot extra = 1 REST **por data**, só se a data não existe localmente. Worker = 1 REST/data/ciclo (hoje ~7/dia). Budget 10k / cap 8500.

### Desenho (barato → mais alcance)

1. **Alinhar injeção = worker (7 dias úteis).** Zero REST extra. Tiago deixa de parecer “sempre cheio” nos dois dias que já temos.
2. **Subir worker para 10 dias úteis** (~+3 REST/dia, ~90/mês). Cabe no cap. Cobre ~duas semanas de salão.
3. **Parser de data em PT:** “25 de agosto”, “dia 25”, “terça que vem”. Se a data já está no snapshot, só injeta. Se não, `ensureSlotSnapshot` **uma vez**.
4. **Lookahead do profissional pedido:** se o cliente pediu Tiago e a janela injetada tem 0–1 vaga, completar com as próximas datas **já locais**; só então, no máximo **2 datas on-demand por conversa**.
5. Não varrer 30 dias no hot path. Reconcile de agendamentos já cobre 30 dias; slots vagos continuam snapshot, não `GET` por mensagem.

---

## 4. Combo de serviços — tentar concluir, a recepção é fallback

### O que o teste mostrou

O bot **montou** o combo com coerência. Falhou ao inventar `Cliente: 14:30` (turno falso) e ao não emitir `BOOKING_CREATE`. Não falhou por “não saber combinar serviços”.

### Regra nova (I.6)

- **Tentar:** listar serviços, checar `HABILITACAO`, somar durações, propor uma mini-agenda (horários em sequência, mesmo dia se couber), confirmar com o cliente, só então marcar.
- **Não** escalar na primeira combinação bem formada.
- **Escalar** (`motivo=multi_servico`) só se: não cabe na agenda visível; profissionais incompatíveis e o cliente não aceita alternativa; ambiguidade depois de **uma** pergunta; ou mais de um profissional na **mesma** reserva (bullet que permanece).
- Nunca inventar linha `Cliente:`. Nunca `BOOKING_CREATE` sem o cliente confirmar o plano.

### Código

O parser hoje pega **só o primeiro** `[BOOKING_CREATE]`. Caminho seguro sem explodir Trinks:

1. Prompt: propor o plano → confirmar → emitir **um** create por turno (corte, depois o próximo).
2. Depois do smoke: parser aceitar N creates **sequenciais** na mesma resposta, parando no primeiro erro Trinks (não criar o resto).

Smoke mínimo antes de cravar autonomia: 1 combo já visto + 2 combos diferentes (ex. unha + cabelo; corte + barba + outro).

---

## 5. Demais itens autorizados (sem mudança de produto)

| # | Item | Ação |
|---|---|---|
| A | Bolhas cortadas | Um caminho de split; tirar `compact.slice(0, 6)` nocivo; não double-split `<break>` |
| B | Fake `Cliente:` | Prompt + sanitizer no texto do assistente |
| C | Webhook SNS após POST/PATCH | Ops: `last_processed_at` parado em 15/08; parser PT já no ar |
| D | After-hours 422 | Template WABA ou não notificar até ter template |
| E | Takeover P0 #10 | Inbox humano — ainda não rodado |

---

## Ordem de execução sugerida

1. Preço no contexto dinâmico + I.4 (masculino vs feminino) + FAQ snapshot — senão o TESS continua mentindo valor.
2. Recusa Dylan com serviços reais do profissional.
3. Janela 7→10 dias úteis (injeção local primeiro; worker depois).
4. I.6 combo: tentar concluir + parser 1 create/turno; smoke.
5. Splitter de bolhas.
6. SNS / 422 / takeover — fila ops, não bloqueia 1–5.

---

## Fora de escopo desta leva

- `BOT_ACCEPT_ALL`, mover 94831, WABA no portfólio travado, merge em `main`.
- Inventar `valorPromocional` que o Trinks não mandou.
- “Corrigir” Jackie no Corte Feminino no prompt sem conferir o cadastro Trinks.
