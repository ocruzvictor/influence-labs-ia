# Booking Confirmation Flow — Decisão 2-Phase

**Data:** 2026-05-25
**Autores:** @pedro-valerio + @analyst
**Status:** Recomendação — depende de aprovação Victor + implementação backend
**Bug que motiva:** Bot diz "Agendado!" ANTES da Trinks confirmar. Se Trinks falha, cliente é enganado.

---

## 1. Estado atual (incorreto)

```
Cliente confirma → Conversa emite reply "Agendado! ✅" + tag [BOOKING_CREATE]
                 → Backend envia reply ao cliente (cliente já leu "agendado")
                 → Backend chama Trinks
                 → Trinks falha (slot ocupado, dados ruins, 500)
                 → Cliente continua acreditando que está agendado
                 → Cliente chega no salão, não está na agenda
                 → Salão queima
```

## 2. Opção A — 2-Phase strict (recomendada)

```
Cliente confirma → Conversa emite SEM dizer "agendado" + tag [BOOKING_CREATE]
                 → Backend NÃO envia reply ainda
                 → Backend chama Trinks (POST /agendamentos)
                 ├── 201 OK
                 │   → Backend envia: "Pronto! Te esperamos no Studio Tirra...
                 │      Dia X às Y com Z. Valor R$ N. ✅"
                 │   → Persiste booking_id
                 └── erro
                     → Backend envia: "Tive um problema ao confirmar.
                        Deixa eu tentar outro horário próximo?" + reabre slot
                     → Reabre Conversa com contexto de falha + slots vizinhos
```

**Latência:** Trinks responde em ~1–3s. Cliente espera de qualquer jeito (debounce 15s já o ensinou a esperar). Aceitável.

**Vantagens:**
- Nunca mente para o cliente
- Cliente sabe imediatamente se precisa escolher outro slot
- Booking ID persistido só na rota feliz

**Desvantagens:**
- Latência percebida +1–3s vs hoje
- Requer mudança no `processMessage()` — separar "intenção de booking" de "reply"
- Conversa precisa aprender a NÃO dizer "agendado" — só "Vamos confirmar isso aí 👀" ou similar até receber green light do backend

## 3. Opção B — Otimista com compensação

```
Cliente confirma → Bot envia "Agendado!" (mantém UX atual)
                 → Backend chama Trinks paralelo
                 → Trinks falha
                 → Backend envia mensagem de correção em ~3s:
                   "Oxi, deu erro aqui! Te garanto agora outro horário, calma."
```

**Vantagens:** zero mudança na latência percebida na rota feliz.

**Desvantagens:**
- Cliente tem 3s lendo "agendado" antes de ler "erro"
- UX confusa: cliente já se programou mentalmente, agora reverte
- Não resolve o problema raiz — mascara
- Em coexistência (Kapso), 2 msgs seguidas do bot fica feio na tela

## 4. Opção C — Pré-reserva (Trinks → Bot → confirma)

Bot consulta `/disponibilidade` em tempo real ANTES de mostrar slot → cria pré-reserva soft → cliente confirma → bot promove para definitiva.

**Não viável:** Trinks não tem endpoint de pré-reserva. Tentar simular = adicionar estado mutável local que diverge da Trinks.

## 5. Decisão recomendada

**Adotar Opção A.** Razões:

1. **Princípio Pareto:** "se executor consegue fazer errado, processo está errado" — Opção B deixa a porta aberta pra mentira; A fecha.
2. **Confiança > velocidade.** Salão é negócio de relacionamento; mentir 1x destrói. 3s de espera não.
3. **Já temos o desenho.** O parser de tags vira ponto de controle. Conversa não precisa saber se o booking foi feito — backend sabe e responde.
4. **Não muda muito código.** O `processMessage()` já tem etapa "execute action then send reply" — o que muda é a ordem do reply.

## 6. Implementação (referência — não código)

```
async processMessage(msg, ctx) {
  const tessOutput = await callConversa(msg, ctx);
  const tags = parseTags(tessOutput.reply_text);

  if (tags.includes('BOOKING_CREATE')) {
    const sanitizedReply = stripBookingConfirmationLanguage(tessOutput.reply_text);
    const trinksRes = await trinks.createBooking(parseBookingArgs(tags));

    if (trinksRes.ok) {
      const successReply = buildSuccessReply(trinksRes.bookingId, sanitizedReply);
      await kapso.send(successReply);
      await db.persistBooking(trinksRes.bookingId, ctx.clientPhone);
    } else {
      const failReply = buildFailureReply(trinksRes.error);
      await kapso.send(failReply);
      // Recoloca contexto pra Conversa propor próximo slot
    }
  } else {
    // Sem tag — Conversa só dialogou. Envia reply direto.
    await kapso.send(tessOutput.reply_text);
  }
}
```

**Mudanças no prompt do Conversa (já refletidas em `tess-conversa-v2.md`):**
- Ao confirmar, NUNCA escrever "Agendado!". Usar "Vamos confirmar isso" ou "Confirmo aqui o agendamento".
- Emitir `[BOOKING_CREATE ...]` como parte estruturada do output.
- O texto de sucesso final é construído pelo backend, não pela TESS.

## 7. Failure modes a cobrir

| Falha | Resposta ao cliente |
|-------|---------------------|
| Slot acabou de ser ocupado (race) | "Esse horário acabou de fechar. Tenho [X, Y] próximos. Algum funciona?" |
| Trinks 500 / timeout | "Tive um soluço aqui. Em 1 min tento de novo — pode aguardar?" + retry 1x + fallback humano |
| Dados inválidos (cliente sem CPF, etc.) | "Falta só [campo] pra fechar. Pode me mandar?" |
| Profissional não habilitado | Conversa não devia ter ofertado — bug a montante. Backend retorna ao Conversa com erro estruturado |

## 8. Métricas a monitorar pós-deploy

- `booking_attempted` (tag emitida)
- `booking_succeeded` (Trinks 201)
- `booking_failed` por tipo de erro
- **Taxa de sucesso de booking deve ficar > 95%.** Se cair, voltar para investigação do Conversa (provavelmente ofertando slot inexistente).
