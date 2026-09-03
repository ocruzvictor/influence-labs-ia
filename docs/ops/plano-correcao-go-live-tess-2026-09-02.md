# Plano de correção — Tess 46589 go-live OPEN (rev. 2)

**Orquestração:** @aios-master (Orion) · 2026-09-02  
**Evidência:** vistoria VPS 01/09 18:44 BRT → 02/09 08:26 BRT + comentários do Victor (manhã 02/09)  
**Urgência:** clientes no canal agora. Código que mexe no atendimento sobe **antes** de combo, créditos finos e squad loop.

---

## O que o Victor pediu (rev. 2)

1. **Horários = Trinks, não palpite.** Depois de saber serviço e profissional, a IA só fala inícios que existem na grade e que **cabem** na duração contínua. Não somar janelas. Não dizer confirmado sem POST. Caso simples ela fecha sozinha; HANDOFF só quando o horário pedido realmente não existe.
2. **Meio-termo de crédito.** Manter o perfil scoped BOOKING da noite (tom + consumo bons). Não voltar ao FULL 90k. Ganho extra de eficiência vem de classificar o jeito real de falar (“quero agendar”, “sexta escova jackie”) como SCHEDULING, não de um architecture novo.
3. **Supervisão de negócio 24/7**, além da infra. Persona(s) que olham fidelidade ao prompt/roteiro, acerto de agenda e de sugestão de horário, uso correto da Trinks, qualidade das mensagens, e sugerem ajuste de regra — o dia inteiro, como o resto do Nightwatch.

---

## Três invariantes

| ID | Invariante | Como prova |
|---|---|---|
| I1 | Nenhuma frase de sucesso de agenda vai ao WhatsApp sem commit Trinks (`booking.created` / cancel / reschedule 2xx) | Sanitize sempre no outbound; `finalMessages` só depois do HTTP; evento órfão = `booking.dropped` |
| I2 | Pedido de 1 SKU de tabela + slot válido + prof habilitado → POST ou recusa honesta | `trinks_api_requests.origin=agent_mutation_*` |
| I3 | Relógio oferecido ao cliente é início real da snapshot Trinks e `contiguousMinutes >= duracaoMinutos` | Bloco HORARIOS compacto: sem profissional = ocupação; com profissional = no máx. 1–2 inícios anotados na grade completa |

Perfil de contexto alvo: **BOOKING scoped** (compactação consultiva + 1–2 relógios). FULL só em UNCERTAIN de verdade (preço+data, mídia, texto longo sem sinal de agenda).

---

## Protocolo de horário (comentário 1)

Ordem obrigatória, igual o teste da noite que funcionou:

1. Descobrir **serviço** (SKU de tabela).
2. Descobrir **profissional habilitado**.
3. Só então listar **até 2 inícios** da snapshot daquele prof/dia, já filtrados pela duração contínua.
4. Cliente pede um horário que não está na lista → dizer que não cabe + 1 alternativa listada, ou `HANDOFF_HUMAN motivo=encaixe`.
5. Nunca: inventar 10h+11h “porque juntos dão 90min”; nunca “tá garantido” antes do POST.

Sem profissional ainda: oferta consultiva (há vagas de manhã/tarde) — é isso que segura o crédito. Com profissional (na mensagem ou no histórico, ex. Alisson “quais os horários?”): relógios reais, não occupancy.

---

## Prioridade de execução

### Agora (atendimento ao vivo) — feito nesta sessão no repo

| # | Gap | Mudança |
|---|---|---|
| A1 | “Oi, vim pelo Studio Tirra. Quero agendar” → FULL 90k | `agendar` / `vim pelo` → SCHEDULING |
| A2 | “Sexta + escova + jackie” → `hasMultipleIntents` FULL / TESS failed | Serviço+data+profissional = um bundle SCHEDULING |
| A3 | Jackie/Kamila/Dylan/Eli/Erik fora do detector | Aliases no `PROFESSIONAL_RE` + `profNameMatchesToken` |
| A5 / I3 | Alisson: profissional conhecido e o bloco ainda dizia “não liste horários” | Com prof conhecido, 1–2 inícios reais; duração filtra o que não cabe; anotação usa a **grade completa** |
| B1 | “Tá garantido / vou registrar / recepção confere / já marcado” | Sanitize **sempre** no outbound, não só quando há tag |
| B2 | CREATE parseado sem evento | `booking.dropped` + copy honesta se o POST não rodou |
| B3 (parcial) | Reschedule no plural | Loop em `bookingReschedules[]`; copy de sucesso ainda só após PUT |
| B4 | TESS empty / 2-phase invisíveis no admin | Persiste fallback `tess-fallback` e blocos `trinks-2phase` |

### Hoje ainda, se o canal estabilizar (não bloqueia o deploy de agora)

| # | O quê | Por quê espera |
|---|---|---|
| A4 | Combo sequencial 2 SKUs (Douglas/Bianca) | Precisa prompt 46589 (Victor cola) + resto da story combo-seguro |
| A6 | Leonor: já deu 10h sábado, bot pergunta profissional e larga | Depende de A5 no ar + prompt: fechar com habilitados **naquele** slot |
| B6 | After-hours copy “pedi a reserva” | POST já existe; copy é prompt + 2-phase |
| Wave 0 | Ana Paula, Ana Carolina, Jessica, Alisson | Humano/resume; o bot não muta agenda de cliente preso |

### Depois (crédito fino + squad)

| # | O quê |
|---|---|
| C1 | User duplicado (passive + save pós-TESS) |
| C2 | Créditos Tess: recarga automática de 300 quando restam ≤30. Nox não trata orçamento 1000 como P0. FULL ainda deve cair com A1–A3. |
| C3 | Story-mãe AC12/AC18: combo-seguro **substitui** o veto 2+ |
| Squad loop | Armar `/loop 15m` no Supervisor **depois** do backend no ar |

---

## Wave 0 — clientes presos (ops paralelo)

| Cliente | Ação | Não fazer |
|---|---|---|
| Ana Paula `…7434` | Humano ou resume com nota: escova Jackie sexta de manhã. A2/A3 no código novo evita o FULL. | Não reenviar FULL 90k |
| Ana Carolina `…8528` | Conferir tatuagem 05/09 09:00 vs 12/09. Humano na Trinks. | Bot dizer “já marcado” |
| Jessica `…8027` | Não está na agenda de sábado. Oferecer slot real ou humano. | “Tá garantido” |
| Alisson `…5389` | Já tem 13h sábado (humano). Silêncio até 14:11. | Segundo corte |

---

## Crédito (comentário 2)

Não há uma “versão scope” e uma “versão completa” para escolher. O scoped BOOKING **é** o alvo:

- Cutover e frases reais de cliente → SCHEDULING → compactação (ocupação ou 1–2 relógios).
- FULL continua sendo o fallback conservador (preço+data, mídia, texto longo **sem** sinal de agenda).
- Eficiência extra = menos UNCERTAIN indevido, não cortar o tom da noite.

Gate: `tess.context_bytes` `horarios` < 4k em saudação e em “quero cortar sábado 14h com o Erick”.

---

## Squad 24/7 (comentário 3)

Quatro personas em `squads/tess-nightwatch/`. Nenhuma é modelo puro.

| Persona | Motor | Foco |
|---|---|---|
| Nox (Supervisor) | Grok 4.6 High | Infra + triage P0–P3 + rescue |
| Dex-Night (Dev) | Composer 2.5 Fast | Patch backend |
| Quinn-Watch (Sentinel) | High veredito / Fast testes | I1/I2/I3 no vivo vs Trinks |
| **Mira (Floor Quality)** | High análise / Fast logs | **Negócio:** fidelidade ao prompt/roteiro, acerto de horário e agenda, uso da Trinks, qualidade da mensagem, sugestão de regra — 24/7 |

Mira **não** substitui Quinn. Quinn prova invariante com evento HTTP. Mira lê o fio como o cliente e o salão veriam: “ela ofereceu um horário que não existia?”, “seguiu o roteiro serviço → prof → relógio?”, “handoffou um caso simples?”. Output: nota no `nightwatch-log` + diff sugerido de regra (intent/slots/prompt). Colar prompt TESS continua **só Victor**.

Loop: Supervisor 15 min; Mira no mesmo tick (amostra de mensagens) e um `*audit-floor-quality` a cada ~60 min. Não arma sozinho.

---

## Fora de qualquer agente do squad

- Colar prompt TESS 46589 (Victor).
- POST/PATCH Trinks no lugar do cliente.
- git push / `BOT_ACCEPT_ALL`.

---

## Deploy desta fatia

Arquivos backend: `tess-context-intent.js`, `tess-context-slots.js`, `tess-context-assembler.js`, `slot-windows.js`, `booking-parser.js`, `server.js`.

```
rsync … backend/lib/*.js backend/server.js deploy@72.60.155.118:/opt/influence-labs/backend/
cd /opt/influence-labs/infra && docker compose up -d --build backend && docker compose restart nginx
```

Smoke: cutover “quero agendar” não estoura créditos; “quais horários” com Erick no histórico lista 1–2 relógios; “tá garantido” não chega ao WhatsApp sem POST.
