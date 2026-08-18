# Changelog — prompt TESS 46589

## v3.1.1 — 2026-08-18

**Motivo:** smoke Victor 18/08 — pediu nome/telefone/e-mail/nascimento de cliente já cadastrado; Dylan ofertado para Corte Masculino; expediente mascarou a recusa de habilitação.

**Prompt:** I.1/I.12/NUNCA não pedem telefone no WhatsApp nem formulário de 4 campos se DADOS_CLIENTE já identifica o cliente. CONTEXTO DINÂMICO: `PERFIL` → `DADOS_CLIENTE`.

**Backend:** injeta `DADOS_CLIENTE` com telefone do canal em todo turno; após o 1º turno mantém o cadastro e só descarta HISTORICO ANTERIOR. `isCompatible` antes do POST; se Dylan×corte e fora do expediente, copy de incompatível ganha.

**Rollback prompt:** `archive/tess-conversa-46589-v3.1.0-2026-08-18.md`

## v3.1.0 — 2026-08-18

**Motivo:** smoke Gabriel 17/08 (7 reservas, 2 fora do expediente, duplicata no nascimento). Atlas K1–K8 + Aria/Quinn CONFIRM-WITH-CHANGES.

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
