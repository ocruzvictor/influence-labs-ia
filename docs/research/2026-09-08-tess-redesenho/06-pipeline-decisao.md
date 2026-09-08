# Pipeline de decisão — cobrir o que impacta o resultado

**Orquestra:** Orion  
**Data:** 2026-09-08  
**Status:** ACK **A** · spec APPROVED · story 1 **Ready** (@po GO 8/10) · próximo @dev · sem implementação · sem OPEN  
**Pergunta do Victor:** dá para orquestrar um pipeline que cubra tudo o que é necessário e pode impactar o resultado?

---

## Resposta curta

**Sim.** O menu 1–6 do arquivo 05 era um **recorte de pesquisa** (o que *é* cada hipótese). O objetivo do salão — atendimento **do início ao fim**, mais acurado **e** mais eficiente — exige um **pipeline com dependências**, não uma opção isolada.

**Não** é o `@dr-orchestrator` de 11 mentes. A pesquisa já tem evidência suficiente para *o quê*. O que falta é **especificar e sequenciar** o que muda I1, F3×F5, crédito e escopo — sem implementar tudo de uma vez.

---

## O que “impacta o resultado” (grafo, não lista)

Resultado = **cliente ouve compromisso só quando a agenda mutou** + **salão não perde slot por race** + **crédito sustentável**.

```
I1 (boca = 2xx)  ←──  lock inventário (H4) + sanitize F5 (H3 parcial)
       ↑
walk-in Denise   ←──  Martelo / aceite recepção (H9) — F3×F5
       ↑
PIX/combo/mute   ←──  escopo do 46589 (H5/H6) — só depois do hold existir
       ↑
crédito 65–79k   ←──  prefixo 31k (H2) — split ou slim DEPOIS do I1 subir
       ↑
detecção drift   ←──  DE Cowork auditor + OP006 (H8) — não previne walk-in
       ↑
modelo/Hermes    ←──  H1/H7/H11 — A/B só com lock no ar
       ↑
Office memória   ←──  OpenClaw (H12) — não fecha I1
```

**Regra:** o que está acima **bloqueia** o que está abaixo. Um pipeline que “cubra tudo” **respeita essa ordem**. Um pipeline que rode tudo em paralelo **reabre I1 em três caminhos**.

---

## O que o pipeline cobre vs o que ele **não** faz agora

| Eixo | Cobre nesta orquestra? | Como |
|---|---|---|
| H3/H4 fluxo + lock | **Sim — Onda 1** | Spec hold TTL + estados + sanitize F5 |
| H9 Martelo / F3×F5 | **Sim — Onda 1b** | Spec aceite nomeado + SLA (mesmo epic, story depois do hold) |
| H5/H6 squad / PIX | **Sim — Onda 2** | Spec veto por agente; **gate**: hold live + I1 smoke |
| H8 DE/Cowork auditor | **Sim — Onda 2** | Spike API; detecta, não previne |
| H2 crédito / prefixo | **Sim — Onda 2** | Medir com OP002/OP004 **depois** do lock |
| H1/H7 modelo | **Sim — Onda 3** | A/B só se Onda 1 smoke passar |
| H11 Hermes / H12 OpenClaw | **PARK no epic** | Explicitamente fora do hot-path |
| Relatório FDS / blueprint redo | **Não** | Já no disco; sob demanda |
| Implementação / OPEN | **Não até ACK + stories** | @sm / @dev exclusivos |

---

## Pipeline recomendado (não é SDC ainda)

Adaptação do **Spec Pipeline** AIOX + brownfield — pesquisa já feita (pulo o passo `@analyst *research`).

```
Onda 0  ACK Victor deste arquivo
Onda 1  Spec (lock + Martelo)     @architect + @pedro-valerio + @data-engineer + @ux
Onda 1g QA critique spec          @qa
Onda 1s Epic + stories            @pm / @sm   ← só depois da spec APPROVED
Onda 1i Implementar STORY lock    @dev        ← UMA story; smoke 0007
Onda 2  Spec squad + DE auditor   mesmo time  ← GATE: I1 smoke da Onda 1
Onda 3  Spec A/B modelo           @architect  ← GATE: Onda 1 no ar, não no painel no meio do mês
```

### Onda 0 — decisão (esta sessão)

Victor escolhe **A** (pipeline completo abaixo) ou **B** (só lock, Martelo depois).

### Onda 1 — spec do que fecha I1 (sem código)

| Passo | Agente | Entrega | Veto |
|---|---|---|---|
| 1.1 | @architect | Contrato de estados PROPOSED→HELD→COMMITTING→CONFIRMED; copy condicional; sanitize F5 lexical | Afrouxar I1/I2/I3 = BLOCK |
| 1.2 | @pedro-valerio `*veto-check` + `*fingerprint-check` | Checkpoints do fluxo **alvo** (não redo 23 etapas) | Checkpoint sem dentes = gap 🔴 |
| 1.3 | @data-engineer | Schema hold TTL (Postgres) — **spec**, 0 migration | Hold sem unique (prof, slot) = BLOCK |
| 1.4 | @ux-design-expert | Superfície Martelo mínima (WhatsApp interno / painel 1 ação: assina / nega) | Silenciar bot ≠ assinar |
| 1.5 | @qa `*critique-spec` | GO/NO-GO da spec Onda 1 | NO-GO = não chama @sm |

### Onda 1s — backlog (exclusivo @pm/@sm)

Epic único: **Redesenho commit Tess**. Stories **numeradas e gated**:

1. Hold + sanitize F5 (fecha race 13h + copy T2)
2. Martelo aceite (fecha Denise / F3×F5)
3. *(gate)* Smoke 0007 + I1 replay last4 T1/T2 **sem** OPEN
4. Só então: squad FAQ/BOOKING **ou** slim de prefixo
5. DE auditor assíncrono
6. A/B modelo (Haiku thinking **ou** Sonnet effort) — painel, não no meio do mês

### Onda 2–3 — só com gate

- **Gate I1:** smoke 0007 + replay “hold sem POST = copy sem verbo de reserva”
- **Gate crédito:** OP002/OP004 medem tok **depois** do hold (Lib Forge analysis-only)
- **Gate modelo:** H3/H4 endereçados no código, não só no papel

---

## Por que **não** `@dr-orchestrator` agora

O squad Deep Research (11 agentes, 15–45 min) responde *perguntas abertas com evidência externa*. Aqui as perguntas abertas **já têm veredito**:

| Pergunta DR | Já respondida em |
|---|---|
| 2-phase é o bug? | 01 Pedro + MEMORY — não |
| Falta lock? | H4 confirmada |
| Cowork substitui 46589? | 03 — não no hot-path |
| Hermes day-one? | PARK |
| OpenClaw fecha I1? | não |

Rodar DR agora **atrasa spec** e **não muda** a ordem das ondas. Reservar DR se a spec Onda 1 travar numa **incerteza nova** (ex.: Trinks tem hold nativo? Cowork invoke cabe em SLA?).

---

## Dois caminhos de ACK (escolhe um número)

| # | Decisão | O que acontece na **próxima** sessão |
|---|---|---|
| **A** | Pipeline completo (Ondas 0→1 spec agora; stories depois) | Orion comanda 1.1–1.5 **só spec**. Ninguém implementa. |
| **B** | Só lock (Martelo/squad/DE ficam no epic como stories posteriores, spec mínima agora) | Architect + Pedro + DE schema hold. UX Martelo **depois**. |
| **C** | Quero mais pesquisa formal | `@dr-orchestrator` ON_DEMAND — **não recomendado** agora. |
| **D** | Arquivar. Sem pipeline. | Pesquisa 05 permanece; sem spec. |

**Recomendação Orion: A.** O objetivo ponta a ponta **não cabe** em “só lock” se Denise e F3×F5 já quebraram o 2-phase. A spec da Onda 1 **inclui** Martelo no papel; a **implementação** continua gated (story 1 = hold, story 2 = Martelo).

---

## Travas (iguais)

Sem OPEN · sem POST · sem colar 46589 · sem generate Forge · sem Hostinger · sem story file até @sm depois da spec APPROVED.

---

*Orion · pipeline de decisão · 2026-09-08*
