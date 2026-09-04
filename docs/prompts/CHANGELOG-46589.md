# Changelog — prompt TESS 46589

## v3.2.4 — 2026-09-04

**Motivo:** Chão 8 — pezinho do cabelo = cortesia no intervalo, gratuito, sem agendar. Tess resolve sozinha; zero handoff orcamento_referencia, zero BOOKING_CREATE, zero SKU inventido.

**Prompt:** REGRA ZERO, vocabulário, NUNCA/SEMPRE, Ex.14, VALIDE 28 — pezinho só = cortesia/intervalo/grátis.

**Cola TESS:** Victor colou v3.2.4 no 46589 (~15:56 BRT, “colei.”).  
**Memories:** Orion PATCH 39496 — 4/4 (163141, 163142, 163146, 163147). Registro: `docs/intake/registro-chao8-kb-sync-2026-09-04.md`.  
**Backend 8+9:** publish pendente (live ainda `a9d5af8`).

**Rollback prompt:** `archive/tess-conversa-46589-v3.2.3-2026-09-04.md`

## v3.2.3 — 2026-09-04

**Motivo:** Onda 2 Fase B — léxico do chão (Mira `1000` `4501` `4749` `4905` `0330`). Código Fase A já no ar (`405b005`); o Haiku ainda podia remapear pezinho, voltar ao feminino e ecoar scratch.

**Prompt:** pezinho ≠ pedicure; pé e mão = unha; gênero sticky; tintura = família coloração; Gloss continua não-SKU; prefixo interno de tabela não se fala; quem é maquiador = nomes do snapshot, CREATE maquiagem continua Fefe; VALIDE 28–30; Ex.14–15.

**Cola TESS:** **não** nesta redação. Victor ACK no diff → aí cola `tess-conversa-v3-clean.md` (header v3.2.3). Sem mudar modelo/Thinking/tools. Sem religar kill switch.

**Rollback prompt:** `archive/tess-conversa-46589-v3.2.2-2026-09-03.md`

## v3.2.2 — 2026-09-03

**Motivo:** EPIC tess-commit-honesty P1.1 — I.8/I.1.17/I.12/I.1.3: tag ≠ reserva; banir "Tá garantido" / afirmações antes do backend.

**Prompt:** I.8 fora-de-horário usa frase neutra I.1.16 + tag (sem "Tá garantido"). I.1.17 + NUNCA ampliam ban de afirmações prematuras. I.12: tag ≠ reserva. I.1.3: 6 campos antes do CREATE; cadastro falho → handoff honesto.

**Cola TESS:** Victor cola quando story 2 estiver no ar — **não** Dex.

**Rollback prompt:** `archive/tess-conversa-46589-v3.2.1-2026-09-02.md`

## v3.2.1 — 2026-09-02

**Motivo:** VIC-012 — grade laser da recepção = 2–3 dias no mês, o dia muda.

**Prompt:** I.4 + Ex.11. Tess ainda sem datas / sem CREATE. Pode dizer que não é só sábado e que a recepção encaixa 2–3 dias (sem listar quais).

**Cola TESS:** Victor colou v3.2.1 no 46589 em 02/09/2026 ~23:14 (“colei”).

## v3.2.0 — 2026-09-02

**Motivo:** gate Victor Etapa 10 APROVO + "pode colar" (piso TIA + VIC-001…011).

**Prompt:** laser sem datas (recepção agenda); visagismo R$ 900 + sinal R$ 100 abate (saldo R$ 800); mechas a partir R$ 880 + teste grátis; "fazer pé" = pedicure; cadastro 6 campos; Tiago sem quarta; PIX/link = handoff; Rosa/Rafaela confirm/cancel; penteado Gi / maquiagem Fefe sequencial.

**Cola TESS:** Victor colou v3.2.0 no 46589 em 02/09/2026 ~22:21 (“colei.”). Dashboard (API não atualiza prompt). KB live mergeada + sync collection 39496 (6 memories). Laser sem memory — regra no prompt.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.9-2026-09-02.md`

## v3.1.9 — 2026-09-02

**Motivo:** Vinicius Angeli — Haiku ecoou o checklist VALIDE como `[Validação rápida: …]` no WhatsApp (`kapso send → 200`). O strip D1 só pega tags `CAIXA_ALTA`, então o bloco misto passou. No turno anterior também vazou `TA - Corte Masculino`.

**Prompt:** I.10 + NUNCA + header VALIDE — checklist silencioso; proibido `[Validação…]`, código, JSON, fence.

**Backend (gate produção):** `stripUnknownTags` pega qualquer `[…]` fora da allowlist; `stripModelScratch` remove fences/`<thinking>`/tool XML; strip `TA - ` no texto ao cliente.

**Cola TESS:** Victor — colar `docs/prompts/tess-conversa-v3-clean.md` (v3.1.9) no 46589. O strip no backend é o gate mesmo sem paste.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.8-2026-09-01.md`

## v3.1.8 — 2026-09-01

**Motivo:** Douglas Kazumi (`5511969091305`) — *progressiva e corte* caiu em handoff cego `multi_servico`. Produto: liberar combo de SKU de tabela sequencial; o dano real era janela/habilitação, não “dois serviços”.

**Prompt:** I.1 §5, I.6, I.11, I.12, NUNCA, Ex.10 feliz (progressiva + corte); Ex.10b consultivo; Ex.10c paralelo; VALIDE 6.

**Backend:** remove veto `distinctServiceIds.size >= 2`; `comboOverlaps` → `guard.blocked` `kind=combo_overlap`; pré-scan consultivo/referência no batch. Gates por item (habilitação/expediente/janela) permanecem.

**Cola TESS:** Victor colou v3.1.8 no agente 46589 em 01/09/2026 (antes do rebuild). Backend em produção 02/09 00:40 UTC (`server.js` + `booking-guards.js`, rebuild + restart nginx). Health ok.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.7-2026-09-01.md`

## v3.1.7 — 2026-09-01

**Motivo:** Incidente WhatsApp — leak `[CHECK_AVAILABILITY …]`; Dylan em corte; abort `xau` → FULL (~33 cr).

**Prompt:** I.10 — proibido inventar tags/tool calls; só BOOKING_* e HANDOFF_HUMAN.

**Backend (gate produção):** `stripUnknownTags` allowlist; período só na msg atual; habilitação union; abort draft → FAQ zero slots; CANCEL `fetchSlots:false`.

**Cola TESS:** Victor — ver `docs/handoffs/46589-prompt-v3.1.7-tags.md` (backend strip é gate; paste quando voltar).

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.6-2026-09-01.md`

## v3.1.6 — 2026-09-01

**Motivo:** Incidente WhatsApp 5511964540007 — dump de ~12k chars HORARIOS VAGOS + eco "tabela premium" (Haiku copiou few-shot proibido).

**Prompt:** I.1 oferta consultiva (sem período → perguntar manhã/tarde; com período → 1–2 horários); ban total do token proibido de exclusividade por preço; TA vs equipe sem comparar/upgradear; Ex.1 consultivo.

**Backend:** `tess-context-slots.js` compact BOOKING scoped; `tess-premium-sanitize.js` retry+strip; FAQ vence scheduling_in_progress para funcionamento.

**Cola TESS:** Victor — ver `docs/handoffs/46589-prompt-v3.1.6-oferta-consultiva.md`.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.5-2026-09-01.md`

## v3.1.5 — 2026-09-01

**Motivo:** Fefe 05/09 (maquiagem 120 min em janela de 60), HABILITACAO Eli/Kamila, camuflagem/Gloss sem KB, TESS `failed` sem log útil.

**Prompt:** I.11 minutos contínuos; I.4 camuflagem (não-SKU) + penteado/maquiagem só Gi/Fefe; I.6 handoff orçamento_referencia; VALIDE 12–14.

**Backend:** anota `(NNmin contínuos)` em HORARIOS VAGOS; gate CREATE/RESCHEDULE `janela`; `applyOperationalHabilitacao`; log TESS estruturado.

**Cola TESS:** Victor colou e salvou v3.1.5 no agente 46589 em 01/09/2026. Backend em produção (rsync + rebuild).

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.4-2026-08-31.md`

## v3.1.4 — 2026-08-31

**Motivo:** incidente Gi 28/08 — mechas/luzes cotados a R$0, combo com 3 POST, weekday inventado, "premium", pedir nome, cancel leak.

**Prompt:** I.1/I.6 combo = handoff + zero CREATE; I.4 mechas/luzes = Teste de Mechas, sem preço fechado; I.2 cancel N tags; calendário só via DATA SOLICITADA/HOJE; I.6.1 Tiago; tom ≤3 linhas; anti-premium reforçado.

**Backend:** gates AC17–23 (consultivo, multi_service, cancel N, ownership, DATA SOLICITADA). Deploy VPS **antes** de colar este prompt.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.3-2026-08-20.md`

## v3.1.3 — 2026-08-20

**Motivo:** feedback Bruuna laser — negar laser, Claudia na sexta, grade só dias úteis.

**Prompt:** I.4 laser = SKUs Depilação 1/3 áreas e corpo todo (Claudia, só sábado em HORARIOS VAGOS); avulsa = 1 área; cera ≠ laser. KB `depilacao-laser-claudia.md`. NUNCA negar laser / oferecer Claudia sexta. VALIDE trip-wire laser. CONTEXTO exemplo com `(laser)`.

**Backend:** alias `(laser)` no catálogo; snapshot inclui próximos 5 sábados; filtro Claudia sexta na injeção.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.2-2026-08-18.md`

## v3.1.2 — 2026-08-18

Higiene de espaçamento e quebras de linha. **Sem mudança de regra.** Rollback: `archive/tess-conversa-46589-v3.1.1-2026-08-18.md`

## v3.1.1 — 2026-08-18

**Motivo:** smoke Victor 18/08 — pediu nome/telefone/e-mail/nascimento de cliente já cadastrado; Dylan ofertado para Corte Masculino; expediente mascarou a recusa de habilitação.

**Prompt:** I.1/I.12/NUNCA não pedem telefone no WhatsApp nem formulário de 4 campos se DADOS_CLIENTE já identifica o cliente. CONTEXTO DINÂMICO: `PERFIL` → `DADOS_CLIENTE`.

**Backend:** injeta `DADOS_CLIENTE` com telefone do canal em todo turno; após o 1º turno mantém o cadastro e só descarta HISTORICO ANTERIOR. `isCompatible` antes do POST; se Dylan×corte e fora do expediente, copy de incompatível ganha.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.0-2026-08-18.md`

## v3.1.0 — 2026-08-18

**Motivo:** smoke de aderência 17/08 (7 reservas, 2 fora do expediente, duplicata no nascimento). Atlas K1–K8 + Aria/Quinn CONFIRM-WITH-CHANGES.

**Prompt (colar `tess-conversa-v3-clean.md`):**
- ROLE: "salão premium" → "salão de referência"
- I.6: combo 2+ profissionais → `[HANDOFF_HUMAN motivo=multi_servico]` até decisão de produto
- I.8: backend não envia "Te esperamos" com salão fechado agora
- I.11 expediente / I.12 anti-recreate
- Vocabulário ao cliente + formatação WhatsApp (sem markdown)
- Trip-wire `# VALIDE ANTES DE ENVIAR`

**Backend (mesmo commit):**
- Idempotência `BOOKING_CREATE` (sessão + snapshot local)
- `bookingFitsExpediente` recusa create fora do expediente
- Histórico injetado limitado a 8 turnos
- `afterHoursBooking` também no combo

**Rollback prompt:** `archive/tess-conversa-46589-v3.0-2026-08-17.md`

## v3.0 — 2026-08-17 (snapshot `88dce88`)

Prompt clean já com I.10 (1 bolha, sem `<break>` no dia a dia), habilitação, preço/duração no snapshot, combo sequencial, I.4 Dylan. Sem I.11/I.12/idempotência.

## v3.0.2 — 2026-05-26

Arquivo histórico `tess-conversa-v3.md` (PACER + `<break>`). Não é o texto em produção desde os ajustes de junho–agosto.
