# Roteiro de smoke — bot 46589 v3.1.0

**Número do bot:** `+55 11 95502-8331`  
**Recepção humana (não usar):** `+55 11 94831-9426`  
**Quem testa:** Victor (e opcionalmente Dylan/recepção na whitelist)  
**Pré:** prompt v3.1.0 colado no TESS 46589 **e** backend desta fatia no VPS. Sem `BOT_ACCEPT_ALL`.  
**Não confirmar** reserva de cliente real. Se criar booking de teste, **cancele no mesmo fluxo** ou avise a recepção.

Espere **1 bolha** por turno. Sem `**negrito**`. Sem a palavra "premium". Sem "TA - Corte…".

---

## 1. Tiago STOP (preço de um só)

**Você:** `quanto custa cortar com o Tiago?`

**Esperado:** um valor do SKU do Tiago no snapshot. **Não** lista Erick/André nem compara preço. Pode perguntar se quer ver horário. **Uma** mensagem.

**FAIL se:** "Tiago R$X, Erick R$Y" ou "o Tiago é o premium".

---

## 2. Dylan — só unhas

**Você:** `quero cortar com o Dylan`

**Esperado:** recusa. Cita **só** os nomes de serviço de unhas que estiverem no snapshot. Sem "outros tratamentos capilares".

---

## 3. Expediente (K1) — sexta que fecha às 19h

Use a **próxima sexta** (não invente data). Primeiro peça corte masculino com um profissional habilitado nesse dia.

**Você (depois que ele listar horários):** `tem 19:30?`  
ou, se ele não listar 19:30: `quero 19:30 nessa sexta`

**Esperado:** recusa. Oferece slot que **termine ≤ 19h**. Não monta mini-agenda 19:30–22h / 20:30–23:40.

Se ele emitir tag mesmo assim, o **backend** deve responder algo como: horário não fecha no expediente — **sem** criar na Trinks.

**FAIL se:** confirma 19:30+ ou empilha até a madrugada.

---

## 4. Combo que cabe (sequencial, mesmo profissional)

**Você:** `quero corte e barba com o Erick, de tarde, no sábado`

**Esperado:** mini-agenda em sequência (corte depois barba, ou o inverso), soma duração, pede confirmação tripla **antes** da tag. Horários de início em HORARIOS VAGOS; o fim do último ≤ 18h (sábado).

Só diga `pode confirmar` se o plano couber. Depois: **um** card de sucesso por serviço (💅), sem segunda bolha de "Agendado!".

**Limpeza:** `quero cancelar esses horários de teste` e confirme.

---

## 5. Dado solto não recria (K2)

Só depois do passo 4 ter criado.

**Você:** `29/11/1996`

**Esperado:** agradece / registra. **Não** cria de novo. **Não** manda segundo "Prontinho! Te esperamos".

**FAIL se:** mais um card de confirmação ou novo ID na Trinks.

---

## 6. Trocar profissional (K3) — remarcar, não duplicar

Se ainda tiver reserva de teste ativa:

**Você:** `na verdade quero com o André nesse mesmo horário`

**Esperado:** pede o booking da seção / usa cancel+create ou reschedule. A reserva antiga **não** fica viva junto da nova.

Se ficar ambíguo, pode escalar pra recepção — isso é aceitável. Criar a segunda **sem** cancelar a primeira é FAIL.

---

## 7. Dois profissionais no mesmo horário (ainda sem regra de produto)

**Você:** `pode deixar corte com o Erick e mechas com a Jackie no mesmo horário`

**Esperado:** **não** marca paralelo. Passa pra recepção (`Vou pedir pra recepção continuar com você…`). Sem dois `BOOKING_CREATE` com o mesmo `dataHoraInicio`.

---

## 8. Fora de horário (se testar à noite / domingo / segunda)

**Você:** `quero agendar corte sábado de manhã`

**Esperado:** conversa normal, avisa que a recepção confere de manhã. Se confirmar e criar: card **sem** "Te esperamos". Texto tipo registrei / recepção confere.

---

## Como marcar o resultado

| # | Caso | PASS / FAIL | Nota |
|---|---|---|---|
| 1 | Tiago STOP | | |
| 2 | Dylan | | |
| 3 | Sexta 19:30 | | |
| 4 | Combo sequencial | | |
| 5 | Nascimento solto | | |
| 6 | Troca de profissional | | |
| 7 | Paralelo 2 profs | | |
| 8 | After-hours copy | | |

Mande o quadro preenchido nesta thread. Se criar booking de teste, anote o `bookingId` e cancele.
