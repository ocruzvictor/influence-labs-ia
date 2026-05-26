# Plano de Refinamento de Qualidade — Studio Tirra Bot

**Data:** 2026-05-25
**Autores:** @analyst (Alex) + @pedro-valerio
**Insumos:** reunião Pareto 2026-05-22 + handoff aios-master + decisões travadas (multi-agente, Kapso, TESS, Trinks, whitelist)
**Status:** Plano executável. Cada item tem critério de aceite.

---

## 1. Diagnóstico — onde estamos

**O que funciona:**
- Pipeline E2E (webhook → TESS → Trinks → reply) já fez agendamento real.
- Whitelist + HMAC + dedupe sólidos.
- Memória persistente (`conversation_history` + `clients`).
- Backend em produção no VPS, cert válido até ago/2026.

**O que está "mais ou menos":**
- Conversa monolítica — mistura diálogo, qualificação, ação. IA "pula linhas" (Bonfim).
- Bot diz "Agendado!" antes da Trinks confirmar — risco de mentira ao cliente.
- TESS não emite `[BOOKING_CANCEL]` / `[BOOKING_RESCHEDULE]` confiável.
- Não há agente de transcrição — áudio fica fora.
- Não há supervisor ativo — qualquer queima passa despercebida.
- Escalação humana ("quero falar com pessoa") não capturada.

**O que tem dívida estrutural (não é qualidade do bot, mas afeta o produto):**
- Certbot loop morto (renovação automática quebrada).
- Sem pg_dump diário, sem monitor externo.
- sessionState em memória (perde em restart).
- Sem rate limit, sem TTL em `conversation_history`.

## 2. Visão geral — o que este plano resolve

Reorganiza a arquitetura em **multi-agente segregado** (Conversa + Supervisor + Transcrição), redesenha o prompt do Conversa em Crisp, introduz o Supervisor (já tem rascunho 46590), corrige o 2-phase do booking, e prepara terreno para áudio.

**Não toca:** decisões travadas, código backend sem aprovação Victor.

---

## 3. Priorização

### P0 — Esta semana (impacto direto na qualidade percebida)

| Item | Onde | Aceite |
|------|------|--------|
| Subir prompt Conversa v2 (Crisp) no agente 46589 | Painel TESS | Os 5 testes do plano de migração em `tess-conversa-v2.md` passam |
| Configurar modo Sistemático + criatividade Baixa no 46589 | Painel TESS | Config visível e salva |
| Subir prompt Supervisor v1 no agente 46590 | Painel TESS | Supervisor retorna JSON válido em 3 testes manuais |
| Decidir canal de notificação Tiago (email vs WhatsApp template) | Decisão Victor | Canal escolhido e configurado |
| Implementar 2-phase booking no backend (Opção A) | `backend/server.js` `processMessage()` | Trinks falha controlada: cliente NÃO recebe "agendado" se Trinks erra |

### P1 — Próximas 2 semanas (capacidades faltantes)

| Item | Onde | Aceite |
|------|------|--------|
| Agente de transcrição de áudio | Provider externo (Whisper/Deepgram) + backend | Áudio do cliente vira texto antes do Conversa |
| Integração Supervisor síncrona (gatilho por tag) | Backend: chamar Supervisor quando tag `[HANDOFF_HUMAN]` aparece | Tag dispara notificação ao Tiago em < 30s |
| Cron Supervisor 4x/dia | Backend novo job | Varredura roda e Tiago recebe resumo |
| KB reorganizada (5 arquivos descritos no prompt v2) | Painel TESS KB | Os 5 arquivos existem e contêm o conteúdo certo |

### P2 — Próximo mês (robustez + UX)

| Item | Onde | Aceite |
|------|------|--------|
| Cache Trinks (slots + serviços) | Backend, TTL 60s | Reduz chamadas externas de 3 para 1 por msg |
| sessionState em Redis/Upstash | Infra + backend | Restart do container não perde estado |
| pg_dump diário automático | VPS cron | Backup em S3/B2 funcional, restore testado |
| UptimeRobot no /health | External | Alerta no Telegram/email se /health falhar |
| Fix do loop certbot | VPS infra | Renovação automática volta a funcionar (antes ago/2026) |

### P3 — Quando fizer sentido (não-bloqueante)

- Templates Meta + payment method na BM Influence Labs (mensagens fora 24h).
- Rate limit nos webhooks.
- TTL/archival do `conversation_history`.
- Rotação de secrets vazados no chat.
- App Meta dormente — manter como contingência ou descartar.

---

## 4. Sequência recomendada de implementação

**Dia 1 (Victor, ~2h):**
1. Lê `docs/prompts/tess-conversa-v2.md` inteiro.
2. Cola no agente 46589.
3. Configura modo Sistemático + criatividade Baixa.
4. Faz os 5 testes do plano de migração (no próprio painel TESS, fora do bot real).
5. Se passou todos → ok deixar como rascunho até backend estar pronto.

**Dia 2 (Victor, ~1h):**
1. Cola prompt Supervisor v1 no agente 46590.
2. Testa com 3 conversas mockadas (reclamação, pedido humano, conversa OK).
3. Confirma que sai JSON válido.

**Dia 3-5 (backend, com aprovação Victor):**
1. Implementa 2-phase booking conforme `docs/architecture/booking-confirmation-flow.md` seção 6.
2. Adiciona chamada Supervisor síncrona quando tag `[HANDOFF_HUMAN]` aparece.
3. Escolhe canal de notificação Tiago — começa com email/SMTP simples.

**Dia 6:**
1. Promove Conversa v2 em produção.
2. Acompanha 24h de logs e a 1ª escalação do Supervisor.
3. Calibra severity threshold com base em primeiros casos.

**Semana 2-3:**
- Transcrição de áudio.
- Cron Supervisor.
- Reorganização da KB.

---

## 5. KPIs do refinamento

| KPI | Meta | Como medir |
|-----|------|-----------|
| Taxa de aderência a script (5 testes manuais semanais) | > 90% | Bateria de 5 cenários típicos, checklist sim/não |
| Taxa de sucesso de booking (Trinks 201 / tentativas) | > 95% | Log no Postgres |
| Tempo médio Trinks → reply de sucesso | < 5s | Log |
| Falsos positivos do Supervisor (Tiago marca "não precisava") | < 30% na semana 1, < 15% após calibração | Feedback manual Tiago |
| Escalações ao Tiago que viraram retenção/venda | > 50% | Tiago anota em planilha simples |
| Conversas com áudio que o bot conseguiu atender | > 80% pós-P1 | Métrica nova |

---

## 6. O que NÃO faremos (anti-overengineering)

- ❌ Agente Roteador, agente de Conclusão, agente de Vendas separado — backend determinístico + 3 agentes (Conversa, Supervisor, Transcrição) já cobrem.
- ❌ Migração para outro LLM provider antes de testar TESS bem configurado.
- ❌ Reescrita do backend — mudanças cirúrgicas em `processMessage()` e adição de job de cron.
- ❌ Sistema de feedback do cliente em-bot ("avalie de 1 a 5") — Supervisor + Tiago vê qualidade.
- ❌ Substituir Kapso ou voltar ao Meta direto sem nova evidência.

## 7. Riscos do plano e mitigações

| Risco | Mitigação |
|-------|-----------|
| Prompt v2 quebra algo que v1 fazia bem | Bateria de 5 testes ANTES de promover; rollback = colar v1 de volta |
| Supervisor satura Tiago com falsos positivos | Severity conservadora; calibração semana 1; só email no início |
| 2-phase aumenta latência percebida | Mensagem ponte ("Confirmo aqui...") sinaliza ao cliente que algo está acontecendo |
| Backend mudança quebra produção | Branch feature; teste local; deploy fora de horário comercial do salão |
| Tiago não usa o canal de notificação | Validar com Tiago ANTES de implementar; talvez ele prefira WhatsApp interno |

## 8. Decisões pendentes (Victor precisa responder)

1. **Canal de notificação ao Tiago:** email, WhatsApp interno, ou outro?
2. **Provider de transcrição:** OpenAI Audio (mais fácil, já tem chave), Whisper self-host, Deepgram?
3. **Quem reorganiza a KB?** Victor sozinho ou delega para o Tiago listar o que tem hoje?
4. **Janela para deploy do backend:** noite, domingo, ou só fora do horário do salão?
5. **2-phase: Opção A pura ou A com "mensagem ponte" amigável?** (Recomendação: A com ponte.)

---

## 9. Próximo passo concreto

Victor pega `docs/prompts/tess-conversa-v2.md`, cola no agente 46589, faz os 5 testes do plano de migração. Reporta resultado. Daí define se promove em produção (com ou sem o 2-phase backend) ou pede ajuste.

**Tempo estimado para Victor sair daqui com bot melhor:** 1 dia para o prompt v2 sozinho (sem backend), 1 semana para o pacote completo P0 (com 2-phase + Supervisor síncrono).
