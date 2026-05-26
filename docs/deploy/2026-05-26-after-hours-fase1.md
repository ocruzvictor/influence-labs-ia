# Deploy Fase 1: Bot ciente de fora-de-horário + notificação Tiago

**Branch:** `feature/booking-2phase-v2` (continuação)
**Data:** 2026-05-26
**Escopo:** detecção de horário comercial + injeção no contexto dinâmico + notificação Tiago em booking fora-de-horário

## O que entra

1. `isSalonOpen()` — função pura no backend. Lógica: Ter-Sex 9-19h, Sáb 9-18h, Dom-Seg fechado, fuso `America/Sao_Paulo`.
2. Contexto dinâmico injeta `HORARIO_AGORA: HH:MM (DENTRO|FORA)` em toda mensagem.
3. `notifyTiagoAfterHoursBooking()` — quando booking criado E `!isSalonOpen` → manda WhatsApp ao Tiago com resumo + Trinks ID.
4. Prompt v2 atualizado com instrução I.8 (fora-de-horário): bot continua agendando, mas avisa cliente que Gabriel confere de manhã.

## Atualização do prompt no painel TESS

No agente 46589, **adicionar a seção I.8** entre `### I.7 — Mensagens sequenciais (debounce)` e `## S — STYLE`. Conteúdo exato em `docs/prompts/tess-conversa-v2.md` linhas 124-138.

Também atualizar o bloco `## CONTEXTO DINÂMICO` para incluir o campo `HORARIO_AGORA` (já adicionado no .md).

## Deploy

```bash
ssh deploy@72.60.155.118
cd /opt/influence-labs/infra
git pull
docker compose up -d --build backend
curl -s https://api.studiotirra.com.br/health | grep -i ok
```

Não há mudança em `.env` desta vez.

## Smoke test em produção

⚠️ Salão fecha hoje 19h ter-sex. Se você testar à noite, está fora-de-horário automaticamente.

### Teste FH-1 — bot reconhece fora-de-horário

Manda do seu número: "tem horário pra amanhã às 10h?"

**Esperado:**
- Bot oferece slots de amanhã normalmente
- Pode mencionar que vai registrar e Gabriel confere de manhã

### Teste FH-2 — booking fora-de-horário com notificação Tiago

Manda agendamento completo (3 turnos: pedido → escolha slot → confirma)

**Esperado:**
- Bot cria booking na Trinks normalmente
- Cliente recebe 2 mensagens: confirmação adaptada ("Vou registrar... Gabriel confere logo cedo") + bloco final do backend com endereço/valor
- **Tiago (0330) recebe DUAS notificações:**
  - 📅 "Agendamento criado FORA do horario..." com Trinks ID
  - (somente se handoff também disparar)

🚨 Cancela o booking no painel Trinks depois de testar.

## Rollback

### Rollback de código (automatizado)

```bash
cd /opt/influence-labs
git checkout HEAD~1 -- backend/server.js  # ou commit anterior específico
docker compose -f infra/docker-compose.yml up -d --build backend
```

### Rollback de prompt (manual — IMPORTANTE)

O rollback de código **não** reverte a mudança feita no painel TESS (agente 46589). Pra reverter completamente:

1. **Acessar painel TESS** → agente 46589 → prompt
2. **Remover a seção I.8** (entre `### I.7 — Mensagens sequenciais (debounce)` e `## S — STYLE`)
3. **Restaurar `## CONTEXTO DINÂMICO`** — remover linha `HORARIO_AGORA: HH:MM (...)` que foi adicionada
4. **Salvar** no painel — efeito imediato

Referência canônica do prompt antes da mudança: ver `docs/prompts/tess-conversa-v2.md` em commit pré-Fase 1 (`git log -- docs/prompts/tess-conversa-v2.md`).

Sem essa etapa manual o bot continua tentando lidar com fora-de-horário no prompt, mesmo com código revertido — resultado pode ser inconsistente (LLM espera campo `HORARIO_AGORA` que não vem mais).

## Fase 2 (pendente)

Supervisor matinal 7h ter-sáb: cron node-cron, varre conversation_history últimas 24h (terça: 48h), chama TESS 46590 por conversa, agrega top N priorizado, envia WhatsApp pro Tiago.

Implementação separada em commit posterior.
