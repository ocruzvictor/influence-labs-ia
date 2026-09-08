# MEMORY — Tess T1 + T2 FDS (08/09/2026)

Memória de projeto. **Não** reler o corpus na sessão nova: apontar e mergulhar só no arquivo necessário.

| Peça | Onde |
|---|---|
| Relatório longo (SOT) | `docs/analysis/2026-09-08-relatorio-teste-fds.md` |
| Dossiê insumos | `docs/analysis/2026-09-08-dossie-insumos-teste-fds.md` |
| Cruzamento HTTP | `docs/intake/teste-fds-2026-09-05/corpus/cruzamento-tess-trinks-recepcao.md` |
| Handoff pesquisa | `docs/handoffs/2026-09-08-orion-handoff-redesenho-pesquisa.md` |
| Créditos (chats) | [47395769](47395769-0c11-4c92-82ed-9b8a2722c19b) · [08df3683](08df3683-fc91-44df-93a0-70c5eca0206d) |
| Dump Kapso terça | [4bb92570](4bb92570-1b51-49e5-bebd-3688e0fb1864) |

---

## No ar (quando fechamos o FDS)

| Peça | Valor |
|---|---|
| Branch | `feature/pilot-first-n-soft-open` |
| VPS backend | `5fd2cad` · `deploy@72.60.155.118` · `api.studiotirra.com.br` |
| Agente | Tess **46589** · prompt **v3.2.6** · Haiku 4.5 **sem Thinking** (trava 01/set) |
| Canal | WhatsApp → Kapso HMAC → Express `processMessage` → tags → guards → Trinks |
| Modo ao fechar | `mode=OFF` · `accept_all=false` · PILOT N=15 run `08ac6673` ainda **active** · 11/15 claimed |
| Abort | `bot_toggles.global=false` |
| Dirty tree | ~370 arquivos honesty — **nunca** no mesmo commit |

T1 first-5: run `876b8633` **frozen**. T2: **não misturar scores**.

---

## A falha que se repete (norte da pesquisa)

Não é “cenário X quebrou”. É o **mesmo ponto** em ondas e copys diferentes:

**A boca promete compromisso. O sistema não trava inventário e muitas vezes não muta a agenda.**

| Onda | Copy | Dano | last4 |
|---|---|---|---|
| T1 | “Confirmo” + endereço | 0 POST | Rodolfo `9343` |
| T2 | F5 “Já estou confirmando na agenda” | 0 POST · walk-in | César `1734`, Gabriel Correa `6960`, Denise Brito |
| T1+T2 | Oferta verbal = slot | 13h em três fios; relógio sujo | `1734` / `7335` / `4307` |

Quinn: F5 hold **sem POST = I1 FAIL**. Mira: eixo **confirmacao = 0** nas duas ondas. T2 **caso_simples = 0**.

Patches P1/F5 **mudaram a frase**, não o dano. Smoke `0007` desses fixes **não rodou** no go-live T2.

---

## Duas ondas (números, não narrativa)

| | T1 first-5 | T2 FDS N=15 |
|---|---|---|
| Janela | qui 04 ~17:36 → sáb 05 ~16:02 | sáb 05 ~18:18 → ter 08 ~14:47 |
| Claims | 5/5 | 11/15 |
| POST Tess 201 | 1 — Ronaldo `5482` / `526831469` | 1 — Matheus `7335` / `527320806` |
| I1 / I2 / I3 | I1 clássico no Rodolfo | **FAIL / FAIL / FAIL** |
| Veredito | — | **T2 FAIL** · sem go-live |

Creates humanos que a Tess **começou** e não fechou: César, Gabriel Correa, Viviane `2886`, Gabriel Lourenço `4676`, Renato `4307`. Agenda existe; autoria não é dela.

Betina `8157` fora da fila de qualidade. Owner `0330` / smoke `0007` fora do volume.

---

## Acertos (não desfazer sem prova)

- Roteiro curto até o relógio (nome → serviço → dia → prof → 1–2 horas).
- Alan `5206`: leu 16:30 existente, **não** inventou CREATE.
- Guard `combo_overlap` bloqueou POST paralelo (`4676`, `8157`) — dano = não sequenciou 18h+19h.
- F5 tirou “tá certo?” do WhatsApp (pedido da sexta).
- Matheus **chegou** ao 201 (relógio sujo: 13:00 → `213h30` → 13:30).
- Timeout chão 6 **dimensionado**: BOOKING p95 ~9–10 s ≤ 22 s; 1 abort/83; **não** é a alavanca de crédito.
- Ledger crédito 05–08 bateu `tess.turn`: **82 pagas · 1.861 cr · 22,70 cr/paga · 5,13 pagas/fio**.

---

## Erros (precisão de compromisso)

- Hold / “Confirmo” = reserva na cabeça do cliente e do chão. Sem POST. Denise chegou.
- Oferta verbal **não locka** slot (race 13h).
- F3 staff-wins × F5: recepção no fio **mata** o 2-phase (`1734`, `4307`).
- Info-open frágil: classificador erra → mute (`6189`, `9536`, `0797`, `2185`).
- PIX / produto quebra CREATE e come claim (`8194`, `0745`).
- Histórico humano (sinal) ignorado.
- Typo de raciocínio vazou (`213h30`).
- Dra Michele last4 é **`6189`**, não `6169`.
- PILOT mede **volume de fio**, não qualidade de commit.

---

## Crédito (projeção, não golden)

Fórmula: `cr = conv × pagas_por_conv × cr_por_chamada`. Avulso R$ 0,0845. Volume salão **22,7 conv/dia** (159÷7) → **681/mês**. FDS **não** é mix OPEN.

| Ritmo | cr/mês |
|---|---:|
| A golden 2,25×13,5 | 20.685 — **não visto** no FDS |
| B 04/set 4,4×21,7 | **~65.060** (piso operacional) |
| C FDS 5,13×22,70 | **~79.340** se OPEN repetir o FDS |
| D noite OPEN 4,0×25,8 | ~70.279 |

Chão do prompt ~**18 cr** mesmo em MIN (prefixo ~31k tok). Pacote **80k/mês** ainda ganha de 4k+avulso. Split FAQ/BOOKING foi **OUT** do EPIC. Trocar LLM **só** vale se Tess cobrir motor mais barato **e** o prefixo enxugar.

---

## Hipóteses abertas (pesquisa — não decisão)

A sessão nova **questiona o que ficou de pé**. Nenhuma é autorizada como patch.

| ID | Hipótese | Por que o FDS autoriza perguntar |
|---|---|---|
| H1 | O modelo (Haiku 4.5, sem esforço/Thinking) não sustenta compromisso | Typo `213h30`; hold eterno; I1 em copy nova |
| H2 | O chão é o **prompt único 46589** (~31k tok), não o assembler | MIN @ 18 cr com 1,6k chars |
| H3 | O fluxograma 2-phase + hold + tags + F3 é o bug | Mesmo dano T1→T2 após “fix” de copy |
| H4 | Falta **lock de inventário** antes da boca | Race 13h; oferta ≠ reserva |
| H5 | Intent único + info-open é frágil | Mute FAQ; claim em produto |
| H6 | Um agente para FAQ e BOOKING herda o piso caro e a boca perigosa | Split foi OUT; crédito não cai no golden |
| H7 | Open source / effort-selectable / maior-menor pode ser variável | Só se H1 sobreviver a H3–H4 |
| H8 | Digital Employee / Cowork Tess no lugar (ou ao lado) do execute 46589 | API Cowork ≠ WhatsApp 46589 (`docs/guides/tess-api-reference.md`) |
| H9 | Human AI / Syncra (Martelo) é o desenho certo: IA executa, humano assina, sem matar o commit | F3×F5: recepção no fio aborta 2-phase |
| H10 | Squad de agentes > um mega-agente | Split FAQ/BOOKING foi OUT do EPIC; T2 ainda mistura produto/PIX/combo no mesmo 46589 |
| H11 | Hermes (modelo OSS e/ou plugin) muda acurácia ou custo | Hipótese dupla — não fundir; Kapso research 28/08 cita `hermes-agent-plugin` |
| H12 | OpenClaw / Mission Control (Office: memória, heartbeat, hierarquia) fecha o que o 46589 não fecha | Foundation report; não é runtime do FDS |

Ordem: **fluxo/lock (H3/H4) → I1 → squad/DE/Human AI (H10/H8/H9) → modelo/Hermes (H1/H7/H11) → OpenClaw (H12) → custo (H2/H6)**.

Kit de pesquisa (chat [abe0c9e6](abe0c9e6-8bd9-4433-92b9-a08d90ab419c), 08/09 noite): Pedro v1.1.x + Forge analysis-only + presets `.cursor/mcp-presets/` + `squads/deep-research` ON_DEMAND. SOT: `.aiox/squad-activation.yaml`. Handoff: `docs/handoffs/2026-09-08-orion-handoff-redesenho-pesquisa.md`.

---

## Travas (continuam até ACK)

- Sem OPEN / `BOT_ACCEPT_ALL` / `startPilot` / colar prompt 46589 / Hostinger / POST Trinks de teste.
- last4 only. Sem inventar `booking.created`.
- Chão 10 cancel série = STOP. Léxico 2ª onda = recusada.
- Haiku+Thinking = trava 01/set — reabrir só como **A/B pesquisado**, não colar no painel no meio do mês.
- Lib Forge **não** foi o runtime do FDS.

---

## Lacunas honestas

last4 Denise; fios `3861`/`0767` sem amostra; p95 05 e 07 WAIT_TRAFFIC; API Tess `remaining` sem campo.

---

*Orion · memória de projeto · 2026-09-08*
