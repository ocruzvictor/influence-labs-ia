# WhatsApp Studio Tirrá — memória viva (15/08/2026, fechamento de sessão)

Cópia no repo. Espelhar no Claude project memory: `whatsapp-restricao-portfolio-2026-08.md` + `MEMORY.md`.

**Amanhã:** colar `docs/handoffs/whatsapp-bm-influence-labs-ativo-2026-08-15.md` na primeira mensagem + `@aios-master`.

## Estado (não reabrir)

- Bot TESS **46589 ativo** em `+55 11 95502-8331` (Salvy).
- BM Influence Labs `394791787726671` (Victor, verificada). WABA `1342161271401600` limpa.
- Phone Number ID `1197799596760252`. Kapso Dedicated + Kapso credits.
- Webhook `https://api.studiotirra.com.br/webhook/kapso` · só `whatsapp.message.received`.
- Smoke 15/08 `5511964540007`: inbound + resposta no WhatsApp **ok**.
- **Sem go-live** para clientes. Recepção humana: `+55 11 94831-9426` no app.
- Humano no número da API: **Inbox Kapso** (Chatwoot dispensável).
- Diagnóstico 14/08 intacto: portfólio Studio Tirrá `1927873100853482` morto para WhatsApp. Não criar WABA lá.

Relatório: `docs/ops/whatsapp-restricao-portfolio-studio-tirra-2026-08-14.md` (1–8 diagnóstico; 9 religação).

## Flutuando — amanhã / Tiago

1. **Identidade do contato** (Tiago vai perguntar): como o número aparece para o cliente (display name, foto, @username, “Influence Labs” vs “Studio Tirrá”). Display name ainda **não aprovado** (*minor limitations*). Username não claimed. Resolver **depois** do “oi” dele, sem go-live.
2. Tiago `5511937750330`: mandar `oi` para `95502-8331`. Textos prontos no handoff. Proativo da IA falhou (422 / sem template / janela 24h).
3. Testes dele + o que ficou datado desde ~18/06 (prompt, KB, Trinks, horários).
4. Ghost partner do `94831` + case Meta `27264844826545686` — não excluir o app.
5. Templates WhatsApp na WABA nova: lista vazia. Precisa se quiser iniciar conversa.
6. Branch `feature/bot-46589-ajustes-resposta` **não misturar** com esta frente.
7. VPS já tem `KAPSO_PHONE_NUMBER_ID` + webhook secret novos (não commitar secrets).
